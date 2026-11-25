// Market layout: rows and their containers [06б, 10а, 31]. Map and route [15, 18] come later.
import { useMemo } from 'react'
import { Platform } from 'react-native'
import { File, Paths } from 'expo-file-system'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, apiFetch } from '@/lib/api'
import { buildMarketGeo, bundledScheme, type MarketScheme } from '@/lib/market-geojson'
import { affineToGeo, type GeoAffine } from '@/lib/geo'
import { marketKeys } from './keys'
import type { MapHighlight, Market, MarketRoute, MarketRow, MarketSearch, QrResolve, RowDetail } from './types'

export type Side = 'NORTH' | 'SOUTH' | 'WEST' | 'EAST'
export type ContainerSlot = RowDetail['sides'][number]['containers'][number]

export function useRows() {
	return useQuery({
		queryKey: marketKeys.rows,
		queryFn: ({ signal }) => apiFetch<MarketRow[]>('/market/rows', { auth: false, signal }),
		staleTime: 60 * 60_000,
	})
}

/**
 * Containers of a row by side [31]. With `brandId`: `state` HAS_SELLER / NO_SELLER,
 * `sellsBrand` per box and `brandSellers` — «продают Toyota: 9».
 */
export function useRowContainers(rowId: number, brandId?: number) {
	return useQuery({
		queryKey: marketKeys.rowContainers(rowId, brandId),
		queryFn: ({ signal }) =>
			apiFetch<RowDetail>(`/market/rows/${rowId}/containers`, { query: { brandId }, signal }),
		// 10а asks before the row list has loaded.
		enabled: rowId > 0,
	})
}

/**
 * «Моего контейнера нет в списке» — the seller adds it to the row: POST /market/rows/{id}/containers.
 * `side` only when the row has two sides; the server takes the row's only side otherwise. An inactive box comes back to life.
 */
export function useAddContainer() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ rowId, number, side }: { rowId: number; number: number; side?: Side }) =>
			apiFetch<ContainerSlot>(`/market/rows/${rowId}/containers`, { method: 'POST', body: { number, side } }),
		onSuccess: (_, { rowId }) => {
			queryClient.invalidateQueries({ queryKey: marketKeys.row(rowId) })
			queryClient.invalidateQueries({ queryKey: marketKeys.rows })
			queryClient.invalidateQueries({ queryKey: marketKeys.map })
		},
	})
}

/**
 * «Добавить ряд» — the typed row is not in the database: POST /market/rows creates it (not drawn on the map until
 * the admin places it). An existing row comes back as is.
 */
export function useAddRow() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (code: string) => apiFetch<MarketRow>('/market/rows', { method: 'POST', body: { code } }),
		onSuccess: (row) => {
			queryClient.setQueryData<MarketRow[]>(marketKeys.rows, (list) => (list && !list.some((r) => r.id === row.id) ? [...list, row] : list))
			queryClient.invalidateQueries({ queryKey: marketKeys.rows })
		},
	})
}

// ─── Market scheme for the map [15, 18] ──────────────────────────────────────

const CACHE_NAME = 'market-map.json'

interface CachedScheme {
	etag: string
	scheme: MarketScheme
}

/** The device cache: a file on iOS/Android (the scheme is ~90 KB), localStorage on web. */
async function readCache(): Promise<CachedScheme | null> {
	try {
		if (Platform.OS === 'web') {
			const raw = globalThis.localStorage?.getItem(CACHE_NAME)
			return raw ? (JSON.parse(raw) as CachedScheme) : null
		}
		const file = new File(Paths.document, CACHE_NAME)
		return file.exists ? (JSON.parse(await file.text()) as CachedScheme) : null
	} catch {
		return null
	}
}

function writeCache(value: CachedScheme) {
	try {
		const text = JSON.stringify(value)
		if (Platform.OS === 'web') globalThis.localStorage?.setItem(CACHE_NAME, text)
		else new File(Paths.document, CACHE_NAME).write(text)
	} catch {}
}

/**
 * GET /market/map with `If-None-Match` — 304 keeps the cached scheme. Offline and on the very
 * first start the bundled src/data/market-map.json is used, so the map always renders.
 */
async function fetchScheme(): Promise<MarketScheme> {
	const cached = await readCache()
	try {
		const res = await fetch(`${API_URL}/api/v1/market/map`, {
			headers: cached ? { 'If-None-Match': cached.etag } : undefined,
		})
		if (res.status === 304 && cached) return cached.scheme
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		const scheme = (await res.json()) as MarketScheme
		writeCache({ etag: res.headers.get('ETag') ?? `"map-v${scheme.version}"`, scheme })
		return scheme
	} catch {
		return cached?.scheme ?? bundledScheme()
	}
}

export function useMarketScheme() {
	return useQuery({
		queryKey: marketKeys.map,
		queryFn: fetchScheme,
		initialData: bundledScheme,
		initialDataUpdatedAt: 0,
		// магазины в контейнерах меняются — схему перепроверяем раз в 5 минут (ETag: без изменений — 304)
		staleTime: 5 * 60_000,
	})
}

/** GeoJSON of the market with highlighted rows — for MarketMapLive. */
export function useMarketGeo(highlightedRowIds: number[] = [], targetContainerId?: number, highlightedContainerIds: number[] = []) {
	const scheme = useMarketScheme().data
	const key = highlightedRowIds.join(',')
	const cellsKey = highlightedContainerIds.join(',')
	return useMemo(
		() => buildMarketGeo(scheme, highlightedRowIds, targetContainerId, highlightedContainerIds),
		// eslint-disable-next-line react-hooks/exhaustive-deps -- ids compared by value
		[scheme, key, targetContainerId, cellsKey],
	)
}

/** Карта рынка без контейнеров (Геология…): тот же формат, что у Кудайбергена, плюс своя матрица GPS. */
export type MarketPlan = MarketScheme & { geo: GeoAffine }

export function useMarketPlan(marketId: number | undefined) {
	return useQuery({
		queryKey: ['market', 'plan', marketId],
		queryFn: async ({ signal }) => (await (await fetch('/dev-plan-4.json', { signal })).json()) as MarketPlan, // DEV-HACK
		enabled: marketId != null,
		staleTime: 30 * 60_000,
	})
}

/** GeoJSON карты другого рынка — для MarketMapLive (prop geo). */
export function usePlanGeo(plan: MarketPlan | undefined) {
	return useMemo(() => (plan ? buildMarketGeo(plan, [], undefined, [], affineToGeo(plan.geo)) : undefined), [plan])
}

/**
 * «Mercedes-Benz — в 6 рядах · 21 бокс · ближайший ряд 14, 170 м» [15].
 * categoryId вместе с маркой — «Toyota · Оптика»: только продавцы марки в этой категории.
 * Without a point the server counts from the entrance nearest to the container.
 */
export function useMapHighlight(kind: 'BRAND' | 'CATEGORY', id: number | undefined, categoryId?: number) {
	const query = categoryId ? { kind, id, categoryId } : { kind, id }
	return useQuery({
		queryKey: marketKeys.highlight(query),
		queryFn: ({ signal }) => apiFetch<MapHighlight>('/market/map/highlight', { query, auth: false, signal }),
		enabled: Boolean(id),
		placeholderData: keepPreviousData,
	})
}

/** Route to a box [18]: polyline over the passages, minutes, metres and steps. */
/** Маршрут до бокса. from — GPS покупателя: на рынке путь идёт от него, рядом с рынком — от него через ближайший по пути вход, издалека — от входа. */
export function useRoute(toContainerId: number, from?: { lat: number; lon: number } | null) {
	const query = from ? { toContainerId, fromLat: from.lat, fromLon: from.lon } : { toContainerId }
	return useQuery({
		queryKey: marketKeys.route(query),
		queryFn: ({ signal }) => apiFetch<MarketRoute>('/market/route', { query, auth: false, signal }),
		enabled: toContainerId > 0,
		placeholderData: keepPreviousData,
	})
}

/** «14», «ряд ю», «14 12» — rows and boxes. */
export function useMarketSearch(q: string) {
	return useQuery({
		queryKey: marketKeys.search(q),
		queryFn: ({ signal }) => apiFetch<MarketSearch>('/market/search', { query: { q }, auth: false, signal }),
		enabled: q.trim().length > 0,
		placeholderData: keepPreviousData,
	})
}

/** A row / container QR sticker → the place on the scheme. */
export function useQrResolve(token: string) {
	return useQuery({
		queryKey: ['market', 'qr', token],
		queryFn: ({ signal }) => apiFetch<QrResolve>(`/market/qr/${encodeURIComponent(token)}`, { auth: false, signal }),
		enabled: Boolean(token),
		retry: false,
	})
}

/**
 * Markets: Кудайберген (with the row scheme), Дордой Моторс, Дордой, Геология — the seller's «Где вы продаёте» and
 * the buyer's «Рынок» filter (marketId in /parts/search, /shops, /catalog/videos; 0 — shops off the markets).
 */
export function useMarkets() {
	return useQuery({
		queryKey: ['market', 'markets'],
		queryFn: ({ signal }) => apiFetch<Market[]>('/market/markets', { auth: false, signal }),
		staleTime: 24 * 60 * 60_000,
	})
}

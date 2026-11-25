// Roadside help — contract section 16: «Кто рядом» straight away, without a request and waiting for offers.
// The offline directory is in src/store/useRoadsidePack.ts.
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { CarOrigin, NearbyMaster } from './types'

export const roadsideKeys = {
	nearby: (query: object) => ['roadside', 'nearby', query] as const,
}

/** On a mountain road «есть сеть» often means EDGE with one bar — give up quickly and use the saved directory. */
const NEARBY_TIMEOUT_MS = 6_000

export function useNearbyMasters(params: {
	point: { lat: number; lng: number } | null
	service: string | null
	carId?: number | null
	brandId?: number | null
	origin?: CarOrigin | null
	enabled: boolean
}) {
	// ~100 m grid: the list is not refetched for every GPS jitter.
	const lat = params.point ? Math.round(params.point.lat * 1000) / 1000 : null
	const lng = params.point ? Math.round(params.point.lng * 1000) / 1000 : null
	const query = {
		lat,
		lng,
		service: params.service ?? undefined,
		carId: params.carId ?? undefined,
		brandId: params.carId ? undefined : (params.brandId ?? undefined),
		origin: params.carId ? undefined : (params.origin ?? undefined),
		limit: 30,
	}
	return useQuery({
		queryKey: roadsideKeys.nearby(query),
		enabled: params.enabled && lat !== null && lng !== null,
		retry: false,
		staleTime: 60_000,
		queryFn: ({ signal }) => {
			const controller = new AbortController()
			const timer = setTimeout(() => controller.abort(), NEARBY_TIMEOUT_MS)
			signal.addEventListener('abort', () => controller.abort())
			return apiFetch<NearbyMaster[]>('/roadside/nearby', { query, signal: controller.signal }).finally(() => clearTimeout(timer))
		},
	})
}

// Веб-версия карты: тот же стиль, те же слои (lib/market-cell-layers) и тот же GeoJSON, что и в нативной, но на
// maplibre-gl (браузерный движок) вместо @maplibre/maplibre-react-native (нативный модуль, в вебе не собирается).
// Тот же API — Metro резолвит market-map-live.web.tsx на платформе web автоматически.
//
// Только на вебе: небо с дымкой у горизонта, анимации (пульс входов, огоньки по маршруту),
// виньетка по краям.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { marketMapStyle } from '@/data/map-style'
import { type MarketGeo, routeToGeoJSON } from '@/lib/market-geojson'
import { ANIMATED, CELL_BOX_IDS, PLACE_IDS, marketLayers, type MarketSourceId } from '@/lib/market-cell-layers'
import { mapPalette as palette } from '@/lib/map-palette'
import { useMarketGeo } from '@/api/market'
import { fs, useColors } from '@/theme'
import { t } from '@/i18n'

const MARKET_ZOOM = 16.2
/** Первый показ — пролёт: камера стартует издалека, сверху и с разворота, и опускается на рынок. */
const INTRO_VIEW = { zoom: MARKET_ZOOM - 2.6, pitch: 0, bearing: -75 }
const INTRO_MS = 2800

/**
 * Metro (в отличие от Vite/webpack5) не умеет собирать воркер библиотеки по
 * `new Worker(new URL(...), import.meta.url)`, поэтому автоопределение внутри
 * maplibre-gl не срабатывает — «Worker failed to load». Файл лежит в
 * public/maplibre-gl-worker.mjs (копия из node_modules/maplibre-gl/dist/),
 * Metro отдаёt публичную папку как есть по тому же адресу.
 * Версия файла должна совпадать с version в package.json у maplibre-gl.
 */
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')

export interface MarketMapLiveHandle {
	focusOn: (coordinate: [number, number], zoom?: number) => void
	focusOnRow: (rowId: number, zoom?: number) => void
	focusOnMe: (zoom?: number) => Promise<void>
	zoomBy: (delta: number) => void
	reset: () => void
	/** Показать все точки ([lon, lat]) с отступами — маршрут целиком над шторкой. */
	fitTo: (points: [number, number][], padding?: { top: number; bottom: number; left: number; right: number }) => void
}

interface MarketMapLiveProps {
	/** Карта другого рынка (Геология…) — свой GeoJSON вместо схемы Кудайбергена. */
	geo?: MarketGeo
	/** Тап по магазину справочника; index — номер в scheme.pois. */
	onPlacePress?: (index: number) => void
	highlightedRowIds?: number[]
	route?: number[][]
	showUser?: boolean
	/** Нужный контейнер — яркая метка с номером. */
	targetContainerId?: number
	/** Контейнеры, подсвеченные фильтром («где продают Toyota»). */
	highlightedContainerIds?: number[]
	/** Тап по контейнеру; shopId — продавец в нём (0 — нет). */
	onContainerPress?: (containerId: number, shopId: number) => void
}

type SourceData = Record<MarketSourceId, GeoJSON.FeatureCollection>

function sourceData(geo: MarketGeo, route: number[][] | undefined): SourceData {
	const line = routeToGeoJSON(route ?? [])
	return {
		'market-boundary': geo.boundary,
		'market-passages': geo.passages,
		'market-blocks': geo.blocks,
		'market-cells': geo.cells,
		'market-cell-labels': geo.cellLabels,
		'market-labels': geo.labels,
		'market-places': geo.places,
		'market-entrances': geo.entrances,
		'market-route': line,
		'market-route-flow': line,
		'market-target': geo.target,
		'market-target-label': geo.targetLabel,
	}
}

/** Вся карта одним стилем: подложка, небо, источники рынка и его слои. */
function fullStyle(data: SourceData): maplibregl.StyleSpecification {
	const p = palette
	const base = marketMapStyle(p) as maplibregl.StyleSpecification
	const sources: maplibregl.StyleSpecification['sources'] = { ...base.sources }
	for (const [id, d] of Object.entries(data)) {
		// градиент маршрута требует lineMetrics; пунктир с lineMetrics не рисуется — у огоньков свой источник
		sources[id] = { type: 'geojson', data: d, ...(id === 'market-route' ? { lineMetrics: true } : {}) }
	}
	return {
		...base,
		sources,
		sky: {
			'sky-color': p.sky.sky,
			'horizon-color': p.sky.horizon,
			'fog-color': p.sky.fog,
			'sky-horizon-blend': 0.7,
			'horizon-fog-blend': 0.6,
			'fog-ground-blend': 0.82,
			'atmosphere-blend': 0,
		},
		layers: [...base.layers, ...(marketLayers(p) as maplibregl.LayerSpecification[])],
	}
}

/** Огоньки по маршруту: пунктир «бежит» — сдвиг рисунка по кадрам (как в примере MapLibre). */
const FLOW_STEPS: number[][] = [
	[0, 4, 3],
	[0.5, 4, 2.5],
	[1, 4, 2],
	[1.5, 4, 1.5],
	[2, 4, 1],
	[2.5, 4, 0.5],
	[3, 4, 0],
	[0, 0.5, 3, 3.5],
	[0, 1, 3, 3],
	[0, 1.5, 3, 2.5],
	[0, 2, 3, 2],
	[0, 2.5, 3, 1.5],
	[0, 3, 3, 1],
	[0, 3.5, 3, 0.5],
]

/** Метров в пикселе на этой широте и зуме (тайлы MapLibre — 512 px). */
const metersPerPixel = (lat: number, zoom: number) => (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom)

/** Точка «я»: синяя с белой каймой, пульс, круг точности GPS и конус, куда человек идёт. */
function meMarker(color: string) {
	if (!document.getElementById('market-me-style')) {
		const style = document.createElement('style')
		style.id = 'market-me-style'
		style.textContent = `@keyframes market-me-pulse { 0% { transform: translate(-50%,-50%) scale(1); opacity: .55 } 100% { transform: translate(-50%,-50%) scale(3.4); opacity: 0 } }`
		document.head.appendChild(style)
	}
	const element = document.createElement('div')
	element.style.cssText = 'position:relative;width:0;height:0;pointer-events:none'
	const layer = (css: string) => {
		const node = document.createElement('div')
		node.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);border-radius:50%;${css}`
		element.appendChild(node)
		return node
	}
	const accuracy = layer(`background:${color}1f;border:1px solid ${color}55;transition:width .4s,height .4s`)
	const cone = layer(
		`width:72px;height:72px;border-radius:0;display:none;background:conic-gradient(from -28deg at 50% 50%, ${color}66 0deg, ${color}00 56deg, transparent 56deg);` +
			'-webkit-mask:radial-gradient(circle, #000 0 34px, transparent 35px);mask:radial-gradient(circle, #000 0 34px, transparent 35px)',
	)
	layer(`width:18px;height:18px;background:${color};animation:market-me-pulse 2s ease-out infinite`)
	layer(`width:18px;height:18px;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)`)
	return {
		element,
		setAccuracy(px: number) {
			const size = Math.min(Math.max(px * 2, 0), 600)
			accuracy.style.width = `${size}px`
			accuracy.style.height = `${size}px`
			accuracy.style.display = size > 24 ? 'block' : 'none'
		},
		/** Направление есть только на ходу — стоя на месте конус прячем. */
		setHeading(heading: number | null, speed: number) {
			const moving = heading != null && !Number.isNaN(heading) && speed > 0.4
			cone.style.display = moving ? 'block' : 'none'
			if (moving) cone.style.transform = `translate(-50%,-50%) rotate(${heading}deg)`
		},
	}
}

/** Радиус по зуму — как interpolate в стиле, но в JS (для анимации). */
const byZoom = (zoom: number, z0: number, v0: number, z1: number, v1: number) =>
	v0 + (v1 - v0) * Math.min(Math.max((zoom - z0) / (z1 - z0), 0), 1)

/** Покадровая жизнь карты: пульс входов и огоньки маршрута. ~30 кадров/с. */
function animate(map: maplibregl.Map, hasRoute: () => boolean) {
	let frame = 0
	let last = 0
	let step = -1
	const set = (layer: string, prop: Parameters<maplibregl.Map['setPaintProperty']>[1], value: number | number[]) => {
		if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value)
	}
	const tick = (now: number) => {
		frame = requestAnimationFrame(tick)
		if (now - last < 33 || !map.isStyleLoaded()) return
		last = now
		const s = now / 1000
		const zoom = map.getZoom()

		// входы: кольцо расходится и тает, раз в 2,4 с
		const e = (s % 2.4) / 2.4
		const base = byZoom(zoom, 15, 9, 19, 20)
		set(ANIMATED.entrancePulse, 'circle-radius', base * (0.6 + e * 1.6))
		set(ANIMATED.entrancePulse, 'circle-stroke-opacity', 0.7 * (1 - e) ** 1.5)

		if (hasRoute()) {
			const next = Math.floor(s * 14) % FLOW_STEPS.length
			if (next !== step) {
				step = next
				set(ANIMATED.routeFlow, 'line-dasharray', FLOW_STEPS[step])
			}
		}
	}
	frame = requestAnimationFrame(tick)
	return () => cancelAnimationFrame(frame)
}

export const MarketMapLive = forwardRef(function MarketMapLive(
	{ highlightedRowIds = [], route, showUser = true, targetContainerId, highlightedContainerIds, onContainerPress, onPlacePress, geo: ownGeo }: MarketMapLiveProps,
	ref: Ref<MarketMapLiveHandle>,
) {
	const c = useColors()
	const kudaibergen = useMarketGeo(highlightedRowIds, targetContainerId, highlightedContainerIds)
	const geo = ownGeo ?? kudaibergen
	const onContainerPressRef = useRef(onContainerPress)
	onContainerPressRef.current = onContainerPress
	const onPlacePressRef = useRef(onPlacePress)
	onPlacePressRef.current = onPlacePress
	const marketCenter = geo.center
	const geoRef = useRef(geo)
	const routeRef = useRef(route)
	const containerRef = useRef<HTMLDivElement | null>(null)
	const mapRef = useRef<maplibregl.Map | null>(null)
	const userMarkerRef = useRef<maplibregl.Marker | null>(null)
	const geoWatchId = useRef<number | null>(null)
	/** Первое движение камеры — пролёт с высоты, дальше — обычные короткие переходы. */
	const introDone = useRef(false)
	/** Последняя известная точка человека [lon, lat] — для «Где я» без нового запроса GPS. */
	const meRef = useRef<[number, number] | null>(null)
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const [errorText, setErrorText] = useState('')

	/** Длительность перехода: первый — пролёт. */
	const travel = (normal: number) => {
		if (introDone.current) return normal
		introDone.current = true
		return INTRO_MS
	}

	/** Карта готова (стиль загружен) — до этого команды камеры ждут в очереди, иначе первая (к контейнеру из ссылки) теряется. */
	const readyRef = useRef(false)
	const pendingRef = useRef<((map: maplibregl.Map) => void) | null>(null)
	const camera = (move: (map: maplibregl.Map) => void) => {
		if (readyRef.current && mapRef.current) move(mapRef.current)
		else pendingRef.current = move
	}

	useImperativeHandle(ref, () => ({
		focusOn(coordinate, zoom = 18) {
			// кино: подлёт с разворота и плавный облёт на четверть оборота, потом камера замирает
			camera((map) => {
				map.flyTo({ center: coordinate, zoom, pitch: 55, bearing: -40, duration: travel(1500), curve: 1.6 })
				map.once('moveend', () => map.easeTo({ bearing: -10, pitch: 50, duration: 2400, easing: (k) => 1 - (1 - k) ** 3 }))
			})
		},
		focusOnRow(rowId, zoom = 17.5) {
			const center = geo.rowCenter(rowId)
			if (center) camera((map) => map.flyTo({ center, zoom, pitch: 50, duration: travel(1000) }))
		},
		async focusOnMe(zoom = 18) {
			const me = meRef.current
			if (me) {
				camera((map) => map.flyTo({ center: me, zoom, duration: 700 }))
				return
			}
			if (!('geolocation' in navigator)) return
			navigator.geolocation.getCurrentPosition(({ coords }) => {
				camera((map) => map.flyTo({ center: [coords.longitude, coords.latitude], zoom, duration: 700 }))
			})
		},
		zoomBy(delta) {
			camera((map) => map.easeTo({ zoom: map.getZoom() + delta, duration: 250 }))
		},
		reset() {
			camera((map) => map.flyTo({ center: marketCenter, zoom: MARKET_ZOOM, pitch: 45, bearing: -10, duration: 700 }))
		},
		fitTo(points, padding = { top: 80, bottom: 80, left: 40, right: 40 }) {
			if (!points.length) return
			const bounds = new maplibregl.LngLatBounds(points[0], points[0])
			points.forEach((point) => bounds.extend(point))
			camera((map) => {
				const duration = travel(900)
				map.fitBounds(bounds, {
					padding,
					maxZoom: 19,
					pitch: 45,
					bearing: -12,
					duration,
					// пролёт: медленный старт и мягкая посадка (undefined сюда нельзя — затрёт стандартный easing)
					...(duration === INTRO_MS ? { easing: (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2) } : {}),
				})
			})
		},
	}))

	useEffect(() => {
		if (!containerRef.current) return

		let map: maplibregl.Map
		let introTimer: ReturnType<typeof setTimeout> | undefined
		try {
			map = new maplibregl.Map({
				container: containerRef.current,
				style: fullStyle(sourceData(geoRef.current, routeRef.current)),
				center: marketCenter,
				...INTRO_VIEW,
				maxPitch: 65,
				// ближе коробки становятся огромными, а номера теряются
				maxZoom: 19.6,
				attributionControl: { compact: true },
				fadeDuration: 250,
			})
		} catch (err) {
			setStatus('error')
			setErrorText(err instanceof Error ? err.message : String(err))
			return
		}
		mapRef.current = map

		// Не догрузилась плитка подложки (медленная сеть) — MapLibre дорисует остальное, карта живая.
		// Ошибка на весь экран — только если карта так и не запустилась (стиль, WebGL).
		map.on('error', (event) => {
			const tileFailed = 'tile' in event || 'sourceId' in event || /\.pbf|tiles\./.test(event.error?.message ?? '')
			if (tileFailed || map.loaded()) {
				console.warn('[market-map] ', event.error?.message ?? event)
				return
			}
			setStatus('error')
			setErrorText(event.error?.message ?? t('Неизвестная ошибка карты'))
			console.error('[market-map] ', event.error ?? event)
		})

		// style.load, а не load: load ждёт все плитки подложки (на медленной сети — десятки секунд),
		// а схема рынка своя и рисуется сразу; подложка дорисуется следом
		map.once('style.load', () => {
			setStatus('ready')
			readyRef.current = true
			const pending = pendingRef.current
			pendingRef.current = null
			pending?.(map)
			// экран так и не повёл камеру (нет схемы, нет маршрута) — пролёт к рынку сами, чтобы не висеть над городом
			introTimer = setTimeout(() => {
				if (introDone.current) return
				introDone.current = true
				map.flyTo({ center: marketCenter, zoom: MARKET_ZOOM, pitch: 45, bearing: -12, duration: INTRO_MS })
			}, 2500)
			if (showUser && 'geolocation' in navigator) {
				// «я» вживую — и внутри рынка, и на подходе: точка с пульсом, круг точности, конус направления
				const me = meMarker(c.brand)
				const marker = new maplibregl.Marker({ element: me.element, pitchAlignment: 'map', rotationAlignment: 'map' })
				userMarkerRef.current = marker
				let accuracy = 0
				let lat = marketCenter[1]
				const resize = () => me.setAccuracy(accuracy / metersPerPixel(lat, map.getZoom()))
				map.on('zoom', resize)
				geoWatchId.current = navigator.geolocation.watchPosition(
					({ coords }) => {
						meRef.current = [coords.longitude, coords.latitude]
						accuracy = coords.accuracy ?? 0
						lat = coords.latitude
						resize()
						me.setHeading(coords.heading ?? null, coords.speed ?? 0)
						marker.setLngLat(meRef.current).addTo(map)
					},
					undefined,
					{ enableHighAccuracy: true, maximumAge: 2000 },
				)
			}
		})

		map.on('click', CELL_BOX_IDS, (event) => {
			const props = event.features?.[0]?.properties
			if (props?.containerId) onContainerPressRef.current?.(Number(props.containerId), Number(props.shopId) || 0)
		})
		map.on('click', PLACE_IDS, (event) => {
			const props = event.features?.[0]?.properties
			if (props?.index != null) onPlacePressRef.current?.(Number(props.index))
		})
		map.on('mouseenter', PLACE_IDS, () => {
			if (onPlacePressRef.current) map.getCanvas().style.cursor = 'pointer'
		})
		map.on('mouseleave', PLACE_IDS, () => {
			map.getCanvas().style.cursor = ''
		})
		map.on('mouseenter', CELL_BOX_IDS, () => {
			if (onContainerPressRef.current) map.getCanvas().style.cursor = 'pointer'
		})
		map.on('mouseleave', CELL_BOX_IDS, () => {
			map.getCanvas().style.cursor = ''
		})

		const stop = animate(
			map,
			() => (routeRef.current?.length ?? 0) > 1,
		)

		return () => {
			clearTimeout(introTimer)
			stop()
			if (geoWatchId.current !== null) navigator.geolocation.clearWatch(geoWatchId.current)
			userMarkerRef.current?.remove()
			map?.remove()
			mapRef.current = null
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- карта пересоздаётся только при монтировании компонента
	}, [])

	// Подсветка / схема / маршрут изменились — новые данные в источники, сама карта та же.
	useEffect(() => {
		geoRef.current = geo
		routeRef.current = route
		const map = mapRef.current
		if (status !== 'ready' || !map) return
		for (const [id, data] of Object.entries(sourceData(geo, route))) {
			;(map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data)
		}
	}, [geo, route, status])

	return (
		<View style={[StyleSheet.absoluteFill, { backgroundColor: palette.ground }]}>
			<div ref={containerRef} style={{ width: '100%', height: '100%' }} />

			{/* виньетка: края экрана чуть темнее — взгляд в центр, как в кино */}
			<div
				style={{
					position: 'absolute',
					inset: 0,
					pointerEvents: 'none',
					background: `radial-gradient(ellipse 120% 90% at 50% 45%, transparent 55%, ${palette.vignette} 100%)`,
				}}
			/>

			{status !== 'ready' ? (
				<View
					style={[
						StyleSheet.absoluteFill,
						{ backgroundColor: palette.ground, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
					]}
				>
					<Text style={{ fontSize: fs.base, color: palette.label, textAlign: 'center' }}>
						{status === 'loading' ? t('Загружаю карту…') : t('Карта не загрузилась')}
					</Text>
					{status === 'error' ? (
						<Text selectable style={{ fontSize: fs.sm, color: c.danger, textAlign: 'center' }}>
							{errorText}
						</Text>
					) : null}
				</View>
			) : null}
		</View>
	)
})

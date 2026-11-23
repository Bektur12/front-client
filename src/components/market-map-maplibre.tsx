import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Camera,
	GeoJSONSource,
	Layer,
	LocationManager,
	Map,
	UserLocation,
	type CameraRef,
} from '@maplibre/maplibre-react-native'
import { marketMapStyle } from '@/data/map-style'
import { type MarketGeo, routeToGeoJSON } from '@/lib/market-geojson'
import { marketLayers, type CellLayer, type MarketSourceId } from '@/lib/market-cell-layers'
import { mapPalette as palette } from '@/lib/map-palette'
import { useMarketGeo } from '@/api/market'

const MARKET_ZOOM = 16.2
/** Первый показ — пролёт: камера стартует издалека, сверху и с разворота, и опускается на рынок. */
const INTRO_VIEW = { zoom: MARKET_ZOOM - 2.6, pitch: 0, bearing: -75 }
const INTRO_MS = 2800

/**
 * Style-spec выражения (case/interpolate/…) типизированы в maplibre как глубокие
 * дискриминированные кортежи — плоский JS-массив им формально не соответствует,
 * хотя рантайму важен только валидный JSON. `any` здесь безопаснее, чем
 * подгонять тип под каждое выражение вручную.
 */
type Expr = any

export interface MarketMapLiveHandle {
	/** Приблизить к точке в координатах карты. */
	focusOn: (coordinate: [number, number], zoom?: number) => void
	/** Приблизить к ряду по его id из схемы рынка. */
	focusOnRow: (rowId: number, zoom?: number) => void
	/** Приблизить к текущей позиции пользователя (запросит разрешение, если нужно). */
	focusOnMe: (zoom?: number) => Promise<void>
	/** Приблизить/отдалить на шаг относительно текущего зума. */
	zoomBy: (delta: number) => void
	/** Вернуть обзор всего рынка. */
	reset: () => void
	/** Показать все точки ([lon, lat]) с отступами — маршрут целиком над шторкой. */
	fitTo: (points: [number, number][], padding?: { top: number; bottom: number; left: number; right: number }) => void
}

interface MarketMapLiveProps {
	/** Карта другого рынка (Геология…) — свой GeoJSON вместо схемы Кудайбергена. */
	geo?: MarketGeo
	/** Тап по магазину справочника; index — номер в scheme.pois. */
	onPlacePress?: (index: number) => void
	/** id рядов, которые подсвечены фильтром (GET /market/map/highlight → rowIds). */
	highlightedRowIds?: number[]
	/** Маршрут в координатах схемы рынка. */
	route?: number[][]
	/** Показывать точку пользователя по GPS. */
	showUser?: boolean
	/** Нужный контейнер — яркая метка с номером. */
	targetContainerId?: number
	/** Контейнеры, подсвеченные фильтром («где продают Toyota»). */
	highlightedContainerIds?: number[]
	/** Тап по контейнеру; shopId — продавец в нём (0 — нет). */
	onContainerPress?: (containerId: number, shopId: number) => void
}

/** Слой рынка из общего описания (lib/market-cell-layers) — те же, что в вебе. */
function CellLayerView({ layer }: { layer: CellLayer }) {
	return (
		<Layer
			id={layer.id}
			type={layer.type}
			minzoom={layer.minzoom}
			maxzoom={layer.maxzoom}
			filter={layer.filter as Expr}
			layout={layer.layout as Expr}
			paint={layer.paint as Expr}
		/>
	)
}

export const MarketMapLive = forwardRef(function MarketMapLive(
	{ highlightedRowIds = [], route, showUser = true, targetContainerId, highlightedContainerIds, onContainerPress, onPlacePress, geo: ownGeo }: MarketMapLiveProps,
	ref: Ref<MarketMapLiveHandle>,
) {
	const mapStyle = useMemo(() => marketMapStyle(), [])
	const layers = useMemo(() => marketLayers(), [])
	const kudaibergen = useMarketGeo(highlightedRowIds, targetContainerId, highlightedContainerIds)
	const geo = ownGeo ?? kudaibergen
	const marketCenter = geo.center
	const camera = useRef<CameraRef>(null)
	const currentZoom = useRef(INTRO_VIEW.zoom)
	/** Первое движение камеры — пролёт с высоты, дальше — обычные короткие переходы. */
	const introDone = useRef(false)
	const travel = (normal: number) => {
		if (introDone.current) return normal
		introDone.current = true
		return INTRO_MS
	}
	const routeLine = useMemo(() => routeToGeoJSON(route ?? []), [route])
	const data: Record<MarketSourceId, GeoJSON.FeatureCollection> = {
		'market-boundary': geo.boundary,
		'market-passages': geo.passages,
		'market-blocks': geo.blocks,
		'market-cells': geo.cells,
		'market-cell-labels': geo.cellLabels,
		'market-labels': geo.labels,
		'market-places': geo.places,
		'market-entrances': geo.entrances,
		'market-route': routeLine,
		'market-route-flow': routeLine,
		'market-target': geo.target,
		'market-target-label': geo.targetLabel,
	}
	// экран так и не повёл камеру (нет схемы, нет маршрута) — пролёт к рынку сами, чтобы не висеть над городом
	useEffect(() => {
		const timer = setTimeout(() => {
			if (introDone.current) return
			introDone.current = true
			currentZoom.current = MARKET_ZOOM
			camera.current?.flyTo({ center: marketCenter, zoom: MARKET_ZOOM, pitch: 45, bearing: -12, duration: INTRO_MS })
		}, 3000)
		return () => clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps -- один раз после монтирования
	}, [])
	// источники в порядке их первых слоёв — так и рисуются
	const sources = [...new Set(layers.map((layer) => layer.source))].filter(
		(id) => !id.startsWith('market-route') || (route?.length ?? 0) > 1,
	)

	useImperativeHandle(ref, () => ({
		focusOn(coordinate, zoom = 18) {
			currentZoom.current = zoom
			// кино: подлёт с разворота и плавный облёт на четверть оборота, потом камера замирает
			const duration = travel(1500)
			camera.current?.flyTo({ center: coordinate, zoom, pitch: 55, bearing: -40, duration })
			setTimeout(() => camera.current?.easeTo({ center: coordinate, bearing: -10, pitch: 50, duration: 2400 }), duration + 50)
		},
		focusOnRow(rowId, zoom = 17.5) {
			const center = geo.rowCenter(rowId)
			if (!center) return
			currentZoom.current = zoom
			camera.current?.flyTo({ center, zoom, pitch: 50, duration: travel(1000) })
		},
		async focusOnMe(zoom = 18) {
			const granted = await LocationManager.requestPermissions()
			if (!granted) return
			const position = await LocationManager.getCurrentPosition()
			if (!position) return
			currentZoom.current = zoom
			camera.current?.flyTo({
				center: [position.coords.longitude, position.coords.latitude],
				zoom,
				duration: 700,
			})
		},
		zoomBy(delta) {
			currentZoom.current = Math.min(Math.max(currentZoom.current + delta, 12), 19.6)
			camera.current?.zoomTo(currentZoom.current, { duration: 250 })
		},
		reset() {
			currentZoom.current = MARKET_ZOOM
			camera.current?.flyTo({ center: marketCenter, zoom: MARKET_ZOOM, pitch: 45, bearing: -10, duration: 700 })
		},
		fitTo(points, padding = { top: 80, bottom: 80, left: 40, right: 40 }) {
			if (!points.length) return
			const lons = points.map(([lon]) => lon)
			const lats = points.map(([, lat]) => lat)
			camera.current?.fitBounds([Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)], {
				padding,
				pitch: 45,
				bearing: -12,
				duration: travel(900),
			})
		},
	}))

	return (
		<View style={[StyleSheet.absoluteFill, { backgroundColor: palette.ground }]}>
			<Map
				style={StyleSheet.absoluteFill}
				mapStyle={mapStyle}
				attribution
				logo={false}
				onRegionDidChange={(event) => {
					currentZoom.current = event.nativeEvent.zoom
				}}
			>
				<Camera ref={camera} initialViewState={{ center: marketCenter, ...INTRO_VIEW }} />

				{sources.map((id) => (
					<GeoJSONSource
						key={id}
						id={id}
						data={data[id]}
						// градиент маршрута требует lineMetrics; пунктир с lineMetrics не рисуется — у огоньков свой источник
						lineMetrics={id === 'market-route' ? true : undefined}
						onPress={
							id === 'market-cells'
								? (event) => {
										// тап по контейнеру → карточка (у продавца — профиль)
										const props = event.nativeEvent.features?.[0]?.properties
										if (props?.containerId) onContainerPress?.(Number(props.containerId), Number(props.shopId) || 0)
									}
								: id === 'market-places'
									? (event) => {
											const props = event.nativeEvent.features?.[0]?.properties
											if (props?.index != null) onPlacePress?.(Number(props.index))
										}
									: undefined
						}
					>
						{layers
							.filter((layer) => layer.source === id)
							.map((layer) => (
								<CellLayerView key={layer.id} layer={layer} />
							))}
					</GeoJSONSource>
				))}

				{showUser ? <UserLocation animated accuracy heading /> : null}
			</Map>
		</View>
	)
})

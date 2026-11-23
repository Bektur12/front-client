// Слои рынка поверх подложки — общие для веба (maplibre-gl) и телефона (maplibre-react-native), в палитре из lib/map-palette.
// Порядок списка = порядок отрисовки, слои идут подряд по источникам (на телефоне они вложены в свой GeoJSONSource).
//
// Что делает карту живой:
//  • рынок светится по контуру, как фонарь; проходы — золотые дорожки;
//  • у контейнеров мягкая тень на земле и чуть разная высота — «город» из коробок, а не сетка;
//  • продавцы из приложения — светло-голубые коробки с синей обводкой;
//  • нужный контейнер — сплошная синяя коробка с номером на синей плашке;
//  • маршрут — синий, голубой, к цели густеет до фирменного синего, по нему бегут огоньки.
// Ячейки появляются при приближении, номера — ещё ближе, названия магазинов — у самого ряда.
import { mapPalette, type MapPalette } from '@/lib/map-palette'

/** style-spec выражения: важен валидный JSON (см. Expr в market-map-maplibre). */
type Expr = any

export type MarketSourceId =
	| 'market-boundary'
	| 'market-passages'
	| 'market-blocks'
	| 'market-cells'
	| 'market-cell-labels'
	| 'market-labels'
	| 'market-places'
	| 'market-entrances'
	| 'market-route'
	| 'market-route-flow'
	| 'market-target'
	| 'market-target-label'

export interface CellLayer {
	id: string
	source: MarketSourceId
	type: 'fill' | 'fill-extrusion' | 'line' | 'symbol' | 'circle'
	minzoom?: number
	maxzoom?: number
	filter?: Expr
	layout?: Record<string, Expr>
	paint: Record<string, Expr>
}

/** С какого зума видны ячейки, номера и названия магазинов. */
export const CELL_ZOOM = 16.4
export const NUMBER_ZOOM = 18.2
export const SHOP_ZOOM = 19.2

/** Слои, которые веб анимирует покадрово (на телефоне они стоят на месте). */
export const ANIMATED = {
	entrancePulse: 'market-entrance-pulse',
	routeFlow: 'market-route-flow',
} as const

const isTarget: Expr = ['==', ['get', 'target'], true]
const isShop: Expr = ['==', ['get', 'shop'], true]
/** Выбран другой контейнер — этот гаснет (прожектор на выбранном). */
const isDim: Expr = ['==', ['get', 'dim'], true]
const isHl: Expr = ['==', ['get', 'hl'], true]
const isMuted: Expr = ['==', ['get', 'muted'], true]
const kindIs = (kind: string): Expr => ['==', ['get', 'kind'], kind]
const isShopBlock: Expr = ['in', ['get', 'kind'], ['literal', ['shop', 'anon']]]

/** Магазины запчастей среди точек справочника — синие; СТО, стёкла и прочее — серые. */
const isPartsPlace: Expr = ['in', ['get', 'kind'], ['literal', ['PARTS_NEW', 'PARTS_USED']]]
/** Точки магазинов: тап по ним — карточка магазина. */
export const PLACE_IDS = ['market-place-parts', 'market-place-other']

const zoomed = (stops: number[]): Expr => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops]

/**
 * Коробки контейнеров — по слою на цвет, в том же порядке условий, что был у ['case', …]:
 * выбран другой и продавец → продавец → найден фильтром → выбран другой → обычный.
 */
function cellBoxes(p: MapPalette): CellLayer[] {
	const dimShop: Expr = ['all', isDim, isShop]
	const kinds: { id: string; color: string; filter: Expr }[] = [
		{ id: 'market-cell-fill-dim-shop', color: p.cellShopDim, filter: dimShop },
		{ id: 'market-cell-fill-hl', color: p.cellHl, filter: ['all', isHl, ['!', dimShop]] },
		{ id: 'market-cell-fill-shop', color: p.cellShop, filter: ['all', isShop, ['!', isHl], ['!', isDim]] },
		{ id: 'market-cell-fill-dim', color: p.cellDim, filter: ['all', isDim, ['!', isHl], ['!', isShop]] },
		{ id: 'market-cell-fill', color: p.cell, filter: ['all', ['!', isDim], ['!', isHl], ['!', isShop]] },
	]
	return kinds.map(({ id, color, filter }) => ({
		id,
		source: 'market-cells',
		type: 'fill-extrusion',
		minzoom: CELL_ZOOM,
		filter: ['all', ['!', isTarget], filter],
		paint: {
			'fill-extrusion-color': color,
			'fill-extrusion-height': [
				'interpolate',
				['linear'],
				['zoom'],
				CELL_ZOOM,
				0,
				CELL_ZOOM + 0.8,
				['case', isShop, 1.55, ['+', 0.95, ['*', ['%', ['to-number', ['get', 'containerId'], 0], 5], 0.07]]],
			],
			'fill-extrusion-base': 0,
			'fill-extrusion-opacity': 0.97,
			'fill-extrusion-vertical-gradient': true,
		},
	}))
}

/** Все коробки контейнеров — для кликов и курсора в вебе. */
export const CELL_BOX_IDS = ['market-cell-fill-dim-shop', 'market-cell-fill-hl', 'market-cell-fill-shop', 'market-cell-fill-dim', 'market-cell-fill']

export function marketLayers(p: MapPalette = mapPalette): CellLayer[] {
	return [
		// ── участок рынка: тёплое пятно, светящийся контур, тонкий пунктир по краю
		{
			id: 'market-boundary-fill',
			source: 'market-boundary',
			type: 'fill',
			paint: { 'fill-color': p.plot, 'fill-opacity': 1 },
		},
		{
			id: 'market-boundary-glow',
			source: 'market-boundary',
			type: 'line',
			layout: { 'line-join': 'round' },
			paint: {
				'line-color': p.plotGlow,
				'line-width': zoomed([14, 10, 17, 34, 19, 70]),
				'line-blur': zoomed([14, 10, 17, 30, 19, 60]),
				'line-opacity': 0.32,
			},
		},
		{
			id: 'market-boundary-line',
			source: 'market-boundary',
			type: 'line',
			layout: { 'line-join': 'round' },
			paint: {
				'line-color': p.plotEdge,
				'line-width': zoomed([14, 1.2, 17, 2.4, 19, 3.5]),
				'line-dasharray': [2, 1.6],
				'line-opacity': 0.9,
			},
		},

		// ── проходы: золотые дорожки с мягким сиянием
		{
			id: 'market-passage-glow',
			source: 'market-passages',
			type: 'line',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': p.passageGlow,
				'line-width': zoomed([15, 10, 18, 34, 20, 70]),
				'line-blur': zoomed([15, 8, 18, 26, 20, 56]),
				'line-opacity': ['interpolate', ['linear'], ['zoom'], 17.2, 0.28, 19, 0.12],
			},
		},
		{
			id: 'market-passage-casing',
			source: 'market-passages',
			type: 'line',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': p.passageEdge,
				'line-width': zoomed([15, 4, 18, 14, 20, 34]),
				'line-opacity': ['interpolate', ['linear'], ['zoom'], 17.2, 1, 19, 0.5],
			},
		},
		{
			id: 'market-passage-fill',
			source: 'market-passages',
			type: 'line',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': p.passage,
				'line-width': zoomed([15, 2.5, 18, 11, 20, 29]),
				// близко проход — фон для контейнеров, а не главное на экране
				'line-opacity': ['interpolate', ['linear'], ['zoom'], 17.2, 1, 19, 0.7],
			},
		},

		// ── ряды и прочие блоки: на обзоре — плашки, ближе растворяются, уступая контейнерам
		{
			id: 'market-block-fill',
			source: 'market-blocks',
			type: 'fill',
			paint: {
				'fill-opacity': ['interpolate', ['linear'], ['zoom'], 16.6, 1, 17.6, 0.4],
				'fill-color': [
					'case',
					isShopBlock,
					p.shopBlock,
					kindIs('admin'),
					p.admin,
					kindIs('stall'),
					p.stall,
					isHl,
					p.rowHl,
					isMuted,
					p.rowMuted,
					p.row,
				],
			},
		},
		{
			id: 'market-block-line',
			source: 'market-blocks',
			type: 'line',
			paint: {
				'line-color': ['case', isShopBlock, p.shopBlockEdge, kindIs('admin'), p.adminEdge, isHl, p.rowHlEdge, isMuted, p.rowMutedEdge, p.rowEdge],
				'line-opacity': ['interpolate', ['linear'], ['zoom'], 16.6, 1, 17.6, 0.35],
				'line-width': ['case', isHl, 2, 1],
			},
		},

		// ── контейнеры
		{
			// тень на земле, сдвинутая от солнца — коробки «стоят», а не нарисованы
			id: 'market-cell-shadow',
			source: 'market-cells',
			type: 'fill',
			minzoom: CELL_ZOOM,
			filter: ['!', isTarget],
			paint: {
				'fill-color': p.cellShadow,
				'fill-opacity': ['interpolate', ['linear'], ['zoom'], CELL_ZOOM, 0, CELL_ZOOM + 0.8, 1],
				'fill-translate': ['interpolate', ['linear'], ['zoom'], CELL_ZOOM, ['literal', [0, 0]], 18, ['literal', [1.5, 2.5]], 19.6, ['literal', [4, 7]]],
				'fill-translate-anchor': 'map',
			},
		},
		{
			// ореол вокруг продавцов из приложения
			id: 'market-cell-shop-glow',
			source: 'market-cells',
			type: 'line',
			minzoom: CELL_ZOOM,
			filter: ['all', isShop, ['!', isTarget], ['!', isDim]],
			layout: { 'line-join': 'round' },
			paint: {
				'line-color': p.cellShopGlow,
				'line-width': zoomed([CELL_ZOOM, 2, 18, 8, 19.6, 18]),
				'line-blur': zoomed([CELL_ZOOM, 2, 18, 7, 19.6, 16]),
				'line-opacity': 0.35,
			},
		},
		{
			// чёткая синяя обводка продавца — голубая коробка не теряется на белом
			id: 'market-cell-shop-edge',
			source: 'market-cells',
			type: 'line',
			minzoom: CELL_ZOOM,
			filter: ['all', isShop, ['!', isTarget], ['!', isDim]],
			layout: { 'line-join': 'round' },
			paint: { 'line-color': p.cellShopGlow, 'line-width': zoomed([CELL_ZOOM, 0.8, 18, 1.6, 19.6, 2.4]) },
		},
		// невысокая коробка ~1,1 м, чуть разной высоты — номер (он на земле) остаётся почти на крыше;
		// у продавца — голубая и чуть выше. Найденные фильтром — сплошной синий; продавцы — голубые; выбран другой — всё гаснет.
		// Цвет — отдельным слоем на каждый вид, а не одним ['case', …]: на iOS (maplibre-react-native 11.4 / MapLibre 6.31)
		// data-driven fill-extrusion-color роняет приложение (SIGABRT в operator new) сразу при открытии карты.
		...cellBoxes(p),
		{
			// найденные фильтром горят: синее сияние на любом масштабе, вблизи — вокруг синей коробки
			id: 'market-cell-hl-glow',
			source: 'market-cell-labels',
			type: 'circle',
			filter: ['all', isHl, ['!', isTarget]],
			paint: {
				'circle-radius': zoomed([14, 7, CELL_ZOOM, 14, 18, 22, 19.6, 40]),
				'circle-color': p.cellShopGlow,
				'circle-blur': 1,
				'circle-opacity': 0.5,
				'circle-pitch-alignment': 'map',
			},
		},
		{
			// фильтр по марке на общем плане: коробок ещё нет — контейнеры с этой маркой горят точками, ближе становятся синими коробками
			id: 'market-cell-hl-dot',
			source: 'market-cell-labels',
			type: 'circle',
			maxzoom: CELL_ZOOM + 0.9,
			filter: ['all', isHl, ['!', isTarget]],
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2.5, CELL_ZOOM, 5],
				'circle-color': p.cellShopGlow,
				'circle-stroke-color': '#FFFFFF',
				'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 1, CELL_ZOOM, 1.8],
				'circle-opacity': ['interpolate', ['linear'], ['zoom'], CELL_ZOOM, 1, CELL_ZOOM + 0.9, 0],
				'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], CELL_ZOOM, 1, CELL_ZOOM + 0.9, 0],
				'circle-pitch-alignment': 'map',
			},
		},
		{
			id: 'market-cell-number',
			source: 'market-cell-labels',
			type: 'symbol',
			minzoom: NUMBER_ZOOM,
			filter: ['!', isTarget],
			layout: {
				'text-field': ['get', 'number'],
				'text-font': ['case', isShop, ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]],
				'text-size': ['interpolate', ['linear'], ['zoom'], NUMBER_ZOOM, 9, 20, 14],
				'text-allow-overlap': false,
				'text-padding': 0,
			},
			paint: {
				'text-color': ['case', isDim, p.cellTextDim, isHl, '#FFFFFF', isShop, p.shopText, p.cellText],
				'text-halo-color': ['case', isDim, p.cellDim, isHl, p.cellHl, isShop, p.cellShop, p.cellTextHalo],
				'text-halo-width': 1,
			},
		},
		{
			id: 'market-cell-shop',
			source: 'market-cell-labels',
			type: 'symbol',
			minzoom: SHOP_ZOOM,
			filter: ['all', isShop, ['!', isTarget], ['!', isDim]],
			layout: {
				'text-field': ['get', 'shopName'],
				'text-font': ['Noto Sans Bold'],
				'text-size': 11.5,
				'text-offset': [0, 1.35],
				'text-max-width': 7,
				'text-optional': true,
			},
			paint: { 'text-color': p.shopText, 'text-halo-color': p.shopTextHalo, 'text-halo-width': 1.6 },
		},

		// ── подписи рядов: жирные, разреженные, как таблички над рядами
		{
			id: 'market-label',
			source: 'market-labels',
			type: 'symbol',
			minzoom: 15.5,
			layout: {
				'text-field': ['get', 'label'],
				'text-font': ['Noto Sans Bold'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 16, 10, 19, 15],
				'text-transform': 'uppercase',
				'text-letter-spacing': 0.08,
				'text-allow-overlap': false,
			},
			paint: {
				'text-color': ['case', isHl, p.labelHl, p.label],
				'text-halo-color': p.labelHalo,
				'text-halo-width': 1.6,
				'text-halo-blur': 0.4,
			},
		},

		// ── магазины и сервисы со справочника (Геология…): точки, ближе — названия. Цвет постоянный на слой:
		//    data-driven цвет на iOS (MapLibre 6.31) уже ронял карту — не рискуем.
		{
			id: 'market-place-other',
			source: 'market-places',
			type: 'circle',
			minzoom: 16.4,
			filter: ['!', isPartsPlace],
			paint: {
				'circle-radius': zoomed([16.4, 3, 18, 5.5, 19.5, 8]),
				'circle-color': p.placeOther,
				'circle-stroke-color': '#FFFFFF',
				'circle-stroke-width': 1.5,
			},
		},
		{
			id: 'market-place-parts',
			source: 'market-places',
			type: 'circle',
			minzoom: 16.4,
			filter: isPartsPlace,
			paint: {
				'circle-radius': zoomed([16.4, 3.5, 18, 6, 19.5, 9]),
				'circle-color': p.placeParts,
				'circle-stroke-color': '#FFFFFF',
				'circle-stroke-width': 1.5,
			},
		},
		{
			id: 'market-place-name',
			source: 'market-places',
			type: 'symbol',
			minzoom: 18,
			layout: {
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Regular'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 18, 10, 20, 13],
				'text-anchor': 'top',
				'text-offset': [0, 0.8],
				'text-max-width': 8,
				'text-allow-overlap': false,
			},
			paint: { 'text-color': p.placeText, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.4 },
		},

		// ── входы: точка и пульсирующее кольцо вокруг
		{
			id: 'market-entrance-pulse',
			source: 'market-entrances',
			type: 'circle',
			paint: {
				'circle-radius': zoomed([15, 9, 19, 20]),
				'circle-color': 'rgba(0,0,0,0)',
				'circle-stroke-color': p.entranceRing,
				'circle-stroke-width': 2,
				'circle-stroke-opacity': 0.5,
				'circle-pitch-alignment': 'map',
			},
		},
		{
			id: 'market-entrance-dot',
			source: 'market-entrances',
			type: 'circle',
			paint: {
				'circle-radius': zoomed([15, 4, 19, 9]),
				'circle-color': p.entrance,
				'circle-stroke-color': '#FFFFFF',
				'circle-stroke-width': 2,
				'circle-pitch-alignment': 'map',
			},
		},
		{
			id: 'market-entrance-label',
			source: 'market-entrances',
			type: 'symbol',
			minzoom: 16.5,
			layout: {
				'text-field': ['get', 'label'],
				'text-font': ['Noto Sans Bold'],
				'text-size': 11,
				'text-offset': [0, 1.4],
				'text-transform': 'uppercase',
				'text-letter-spacing': 0.1,
			},
			paint: { 'text-color': p.entranceText, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.6 },
		},

		// ── маршрут: сияние, линия синяя → жёлтая к цели (нужен lineMetrics), огоньки поверх
		{
			id: 'market-route-glow',
			source: 'market-route',
			type: 'line',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': p.routeGlow, 'line-opacity': 0.25, 'line-width': zoomed([15, 10, 19, 26]), 'line-blur': zoomed([15, 6, 19, 16]) },
		},
		{
			id: 'market-route-line',
			source: 'market-route',
			type: 'line',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-width': zoomed([15, 4, 19, 9]),
				'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, p.route, 0.7, p.route, 1, p.routeEnd],
			},
		},
		{
			id: 'market-route-flow',
			source: 'market-route-flow',
			type: 'line',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': p.routeFlow, 'line-width': zoomed([15, 1.6, 19, 3.5]), 'line-opacity': 0.9, 'line-dasharray': [0, 4, 3] },
		},

		// ── нужный контейнер: синяя коробка, белый номер на синей плашке
		{
			id: 'market-target-box',
			source: 'market-target',
			type: 'fill-extrusion',
			paint: {
				'fill-extrusion-color': p.target,
				'fill-extrusion-height': 2.2,
				'fill-extrusion-base': 0,
				'fill-extrusion-opacity': 1,
				'fill-extrusion-vertical-gradient': true,
			},
		},
		{
			id: 'market-target-number',
			source: 'market-target-label',
			type: 'symbol',
			layout: {
				'text-field': ['get', 'number'],
				'text-font': ['Noto Sans Bold'],
				'text-size': ['interpolate', ['linear'], ['zoom'], 15, 14, 19, 21],
				'text-offset': [0, -1.4],
				'text-allow-overlap': true,
				'text-ignore-placement': true,
			},
			paint: { 'text-color': '#FFFFFF', 'text-halo-color': p.target, 'text-halo-width': 5 },
		},
	]
}

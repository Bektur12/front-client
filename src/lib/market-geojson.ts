import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson'
import { type Project, schemaToGeo } from '@/lib/geo'
import bundled from '@/data/market-map.json'
import { t } from '@/i18n'

// The market scheme (GET /market/map, or the bundled copy offline) → GeoJSON for MapLibre.
// Coordinates are scheme pixels (Y down) and go through the GPS calibration in lib/geo.

interface Rect {
	x: number
	y: number
	w: number
	h: number
}

/** The part of MapDto the map needs; the bundled file is converted to the same shape. */
export interface MarketScheme {
	version: number
	boundary: number[][]
	/** Non-row blocks: shops, admin, parking. */
	blocks: { kind: string; rect?: Rect; polygon?: number[][] }[]
	rows: {
		id: number
		code: string
		label: string
		type: string
		/** parts — ряд с разрывом (проход, ворота): рисуется кусками, но остаётся одним рядом. */
		geometry: { rect?: Rect; polygon?: number[][]; parts?: number[][][] }
		/** Контейнеры с центром, углом оси ряда и длиной ячейки (есть только в схеме с сервера). */
		containers?: SchemeContainer[]
	}[]
	passages: { points: number[][]; width: number }[]
	entrances: { x: number; y: number; label: string }[]
	/** Подписи корпусов («76 ст1», «137Б») — есть у карт рынков без контейнеров. */
	labels?: { x: number; y: number; text: string }[]
	/** Точки на карте: у Геологии — магазины и сервисы из справочника (kind PARTS_NEW, PARTS_USED, SERVICE…), стоянки. */
	pois?: SchemePlace[]
}

/** Магазин или сервис на карте рынка без контейнеров (из справочника 2ГИС). */
export interface SchemePlace {
	x: number
	y: number
	/** Название: «Banzai Motors». */
	label: string
	kind: string
	/** Чем занимается: «магазин автозапчастей», «центр авторазбора». */
	what?: string
	address?: string
	/** Этаж, бокс, контейнер — если указано. */
	place?: string
	hours?: string
	lat?: number
	lon?: number
	gisUrl?: string
}

/** Виды точек, которые рисуются как магазины (стоянки и кафе со снимка — нет). */
export const PLACE_KINDS = ['PARTS_NEW', 'PARTS_USED', 'SERVICE', 'GLASS', 'OTHER']

export interface SchemeContainer {
	id: number
	number: number
	side: string
	x: number
	y: number
	angle: number
	length: number
	shop?: { shopId: number | null; name: string | null; avatarUrl: string | null } | null
}

/** Глубина контейнера на схеме: ~2,4 м при 0,25 м на единицу схемы. */
const CELL_DEPTH = 9.6

/** Прямоугольник ячейки контейнера в координатах схемы: длина вдоль оси ряда, глубина поперёк. */
function cellRing(cell: SchemeContainer): number[][] {
	const a = (cell.angle * Math.PI) / 180
	const ux = Math.cos(a)
	const uy = Math.sin(a)
	const hl = (Math.max(cell.length, 6) * 0.86) / 2
	const hd = CELL_DEPTH / 2
	return [
		[cell.x - ux * hl - uy * hd, cell.y - uy * hl + ux * hd],
		[cell.x + ux * hl - uy * hd, cell.y + uy * hl + ux * hd],
		[cell.x + ux * hl + uy * hd, cell.y + uy * hl - ux * hd],
		[cell.x - ux * hl + uy * hd, cell.y - uy * hl - ux * hd],
	]
}

/** Offline fallback: the bundled market-map.json in the server's shape (rows without server ids). */
export function bundledScheme(): MarketScheme {
	const rows: MarketScheme['rows'] = []
	const blocks: MarketScheme['blocks'] = []
	bundled.blocks.forEach((b, i) => {
		const rect = { x: b.x, y: b.y, w: b.w, h: b.h }
		if (b.kind === 'row' || b.kind === 'stall') {
			rows.push({ id: -(i + 1), code: b.label, label: b.label, type: b.kind === 'row' ? 'ROW' : 'STALL', geometry: { rect } })
		} else {
			blocks.push({ kind: b.kind, rect })
		}
	})
	rows.push({ id: -1001, code: t('З'), label: t('З'), type: 'VROW', geometry: { polygon: bundled.zone_Z_polygon } })
	rows.push({ id: -1002, code: t('А'), label: t('А'), type: 'VROW', geometry: { polygon: bundled.row_A_polygon } })
	return { version: 0, boundary: bundled.boundary, blocks, rows, passages: bundled.passages, entrances: bundled.entrances }
}

const toGeo = ([x, y]: number[]) => schemaToGeo(x, y)

function ring(geometry: { rect?: Rect; polygon?: number[][] }): number[][] {
	if (geometry.polygon) return geometry.polygon
	const r = geometry.rect!
	return [
		[r.x, r.y],
		[r.x + r.w, r.y],
		[r.x + r.w, r.y + r.h],
		[r.x, r.y + r.h],
	]
}

function centerOf(points: number[][]): [number, number] {
	const xs = points.map(([x]) => x)
	const ys = points.map(([, y]) => y)
	return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

function polygonOf(points: number[][], properties: Record<string, unknown>, project: (p: number[]) => [number, number] = toGeo): Feature<Polygon> {
	return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [[...points, points[0]].map(project)] } }
}

/** Row label on the map: «Ряд 14», «Жайма 1»; vertical rows by their letter. */
const mapLabel = (row: MarketScheme['rows'][number]) => (row.type === 'VROW' ? row.code : row.label)

export interface MarketGeo {
	boundary: FeatureCollection<Polygon>
	passages: FeatureCollection<LineString>
	/** Rows and other blocks; rows carry `rowId`, `hl` (highlighted) and `muted` (another row is). */
	blocks: FeatureCollection<Polygon>
	labels: FeatureCollection<Point>
	/** Магазины и сервисы справочника: `index` — номер в scheme.pois, `name`, `kind`. */
	places: FeatureCollection<Point>
	entrances: FeatureCollection<Point>
	/** Ячейки контейнеров: `containerId`, `number`, `shop` (есть продавец), `shopId`, `shopName`, `target`, `hl` (фильтр). */
	cells: FeatureCollection<Polygon>
	/** Номера и названия магазинов в центрах ячеек — те же свойства. */
	cellLabels: FeatureCollection<Point>
	/** Нужный контейнер: его коробка (3D, синяя) и точка для номера над ней (пусто, если не задан). */
	target: FeatureCollection<Polygon>
	targetLabel: FeatureCollection<Point>
	center: [number, number]
	/** [lon, lat] of a row's centre — to fly the camera there. */
	rowCenter: (rowId: number) => [number, number] | null
}

export function buildMarketGeo(
	scheme: MarketScheme,
	highlightedRowIds: number[] = [],
	targetContainerId?: number,
	highlightedContainerIds: number[] = [],
	/** Проекция схемы на карту: у Кудайбергена — его опорные точки, у других рынков — матрица из их карты. */
	projectXY: Project = schemaToGeo,
): MarketGeo {
	const toGeo = ([x, y]: number[]) => projectXY(x, y)
	const polygon = (points: number[][], properties: Record<string, unknown>) => polygonOf(points, properties, toGeo)
	const highlightedCells = new Set(highlightedContainerIds)
	const highlighted = new Set(highlightedRowIds)
	const active = highlighted.size > 0
	const kindOf = (type: string) => (type === 'VROW' ? 'vrow' : type === 'STALL' ? 'stall' : 'row')

	const rowFeatures = scheme.rows.flatMap((row) =>
		(row.geometry.parts?.length ? row.geometry.parts : [ring(row.geometry)]).map((part) =>
			polygon(part, {
				rowId: row.id,
				label: mapLabel(row),
				kind: kindOf(row.type),
				hl: highlighted.has(row.id),
				muted: active && !highlighted.has(row.id),
			})
		)
	)
	const otherFeatures = scheme.blocks.map((block) => polygon(ring(block), { kind: block.kind, hl: false, muted: false }))

	const centers = new Map(scheme.rows.map((row) => [row.id, centerOf(ring(row.geometry))]))

	const cells: Feature<Polygon>[] = []
	const cellLabels: Feature<Point>[] = []
	const target: Feature<Polygon>[] = []
	const targetLabel: Feature<Point>[] = []
	for (const row of scheme.rows) {
		for (const cell of row.containers ?? []) {
			const properties = {
				containerId: cell.id,
				number: String(cell.number),
				// синий = продавец из приложения; при фильтре по марке — только те, кто её продаёт
				shop: highlightedCells.size ? highlightedCells.has(cell.id) : Boolean(cell.shop?.shopId),
				shopId: cell.shop?.shopId ?? 0,
				// «Ряд 4, конт. 20» — название, которое повторяет место: на карте не подписываем
				shopName: cell.shop?.name && !/конт|контейнер|^ряд\s/i.test(cell.shop.name) ? cell.shop.name : '',
				target: cell.id === targetContainerId,
				hl: highlightedCells.has(cell.id),
				// прожектор: выбран контейнер — остальные гаснут
				dim: targetContainerId != null && cell.id !== targetContainerId,
				caption: row.type === 'STALL' ? t('{0} · конт. {1}', row.label, cell.number) : t('Ряд {0} · конт. {1}', row.code, cell.number),
			}
			const box = polygon(cellRing(cell), properties)
			cells.push(box)
			const point: Feature<Point> = { type: 'Feature', properties, geometry: { type: 'Point', coordinates: toGeo([cell.x, cell.y]) } }
			cellLabels.push(point)
			if (properties.target) {
				target.push(box)
				targetLabel.push(point)
			}
		}
	}

	return {
		boundary: { type: 'FeatureCollection', features: [polygon(scheme.boundary, { kind: 'boundary' })] },
		passages: {
			type: 'FeatureCollection',
			features: scheme.passages.map((passage, index) => ({
				type: 'Feature',
				properties: { index, width: passage.width },
				geometry: { type: 'LineString', coordinates: passage.points.map(toGeo) },
			})),
		},
		blocks: { type: 'FeatureCollection', features: [...otherFeatures, ...rowFeatures] },
		labels: {
			type: 'FeatureCollection',
			features: [
				...scheme.rows.map((row): Feature<Point> => ({
					type: 'Feature',
					properties: { label: mapLabel(row), hl: highlighted.has(row.id) },
					geometry: { type: 'Point', coordinates: toGeo(centers.get(row.id)!) },
				})),
				...(scheme.labels ?? []).map((label): Feature<Point> => ({
					type: 'Feature',
					properties: { label: label.text, hl: false },
					geometry: { type: 'Point', coordinates: toGeo([label.x, label.y]) },
				})),
			],
		},
		places: {
			type: 'FeatureCollection',
			features: (scheme.pois ?? []).flatMap((poi, index): Feature<Point>[] =>
				PLACE_KINDS.includes(poi.kind)
					? [{ type: 'Feature', properties: { index, name: poi.label, kind: poi.kind }, geometry: { type: 'Point', coordinates: toGeo([poi.x, poi.y]) } }]
					: []
			),
		},
		entrances: {
			type: 'FeatureCollection',
			features: scheme.entrances.map((entrance) => ({
				type: 'Feature',
				properties: { label: entrance.label },
				geometry: { type: 'Point', coordinates: projectXY(entrance.x, entrance.y) },
			})),
		},
		cells: { type: 'FeatureCollection', features: cells },
		cellLabels: { type: 'FeatureCollection', features: cellLabels },
		target: { type: 'FeatureCollection', features: target },
		targetLabel: { type: 'FeatureCollection', features: targetLabel },
		center: toGeo(centerOf(scheme.boundary)),
		rowCenter: (rowId) => {
			const center = centers.get(rowId)
			return center ? toGeo(center) : null
		},
	}
}

/** A route polyline (scheme pixels) → GeoJSON line. */
export function routeToGeoJSON(points: number[][]): FeatureCollection<LineString> {
	return {
		type: 'FeatureCollection',
		features: points.length
			? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map(toGeo) } }]
			: [],
	}
}

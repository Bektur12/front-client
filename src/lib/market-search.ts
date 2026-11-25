// Поиск на карте рынка — по схеме, что уже в телефоне: мгновенно и без сети.
// «14 12», «ряд ю 5», «жайма 2 7» → контейнер; «ю», «ряд 14» → ряд; «тойота центр» → магазин по названию.
// Марки («Toyota») ищет экран отдельно — по справочнику, они включают фильтр «где продают».
import type { MarketScheme, SchemeContainer } from '@/lib/market-geojson'

export type MarketHit =
	| { kind: 'container'; container: SchemeContainer; rowId: number; rowCode: string; rowLabel: string }
	| { kind: 'row'; rowId: number; rowCode: string; rowLabel: string; containers: number }

/** Латиница, похожая на кириллицу: «A», «C», «X» на клавиатуре — это ряды А, С, Х. */
const LOOKALIKE: Record<string, string> = { a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у' }

export function normalizeQuery(text: string) {
	return text
		.toLowerCase()
		.replace(/ё/g, 'е')
		// \b в JS не работает с кириллицей — границы слова пробелами
		.replace(/(^|\s)(ряд|ряда|катар|катары|конт|контейнер|бокс)\.?(?=\s|\d|$)/g, ' ')
		.replace(/[№#,.\-–—/]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

/** Код ряда для сравнения: латиница-двойник → кириллица («x» → «х»). */
const codeKey = (code: string) => normalizeQuery(code).replace(/[a-z]/g, (ch) => LOOKALIKE[ch] ?? ch)

export function searchMarket(scheme: MarketScheme, raw: string, limit = 8): MarketHit[] {
	const query = codeKey(raw)
	if (!query) return []
	const hits: MarketHit[] = []
	// длинные коды первыми: «жайма 2» раньше, чем «2»
	const rows = [...scheme.rows].sort((a, b) => codeKey(b.code).length - codeKey(a.code).length)

	for (const row of rows) {
		const code = codeKey(row.code)
		const containers = row.containers ?? []
		if (query === code) {
			hits.push({ kind: 'row', rowId: row.id, rowCode: row.code, rowLabel: row.label, containers: containers.length })
		} else if (query.startsWith(code + ' ')) {
			const rest = query.slice(code.length + 1)
			if (/^\d+$/.test(rest)) {
				const found = containers.find((cell) => cell.number === Number(rest))
				if (found) hits.push({ kind: 'container', container: found, rowId: row.id, rowCode: row.code, rowLabel: row.label })
			}
		}
	}

	// магазины по названию — от двух букв
	if (query.length >= 2) {
		for (const row of scheme.rows) {
			for (const cell of row.containers ?? []) {
				const name = cell.shop?.name ? normalizeQuery(cell.shop.name) : ''
				if (name && name.includes(normalizeQuery(raw))) {
					hits.push({ kind: 'container', container: cell, rowId: row.id, rowCode: row.code, rowLabel: row.label })
				}
			}
		}
	}

	const seen = new Set<string>()
	return hits
		.filter((hit) => {
			const key = hit.kind === 'row' ? `r${hit.rowId}` : `c${hit.container.id}`
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})
		.slice(0, limit)
}

/** Контейнер по id со своим рядом — для карточки выбранного контейнера. */
export function findContainer(scheme: MarketScheme, containerId: number) {
	for (const row of scheme.rows) {
		const container = row.containers?.find((cell) => cell.id === containerId)
		if (container) return { container, rowId: row.id, rowCode: row.code, rowLabel: row.label }
	}
	return null
}

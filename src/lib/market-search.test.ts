import { searchMarket } from './market-search'
import type { MarketScheme } from './market-geojson'

const cell = (id: number, number: number, shop?: string) => ({
	id,
	number,
	side: 'NORTH',
	x: 0,
	y: 0,
	angle: 0,
	length: 12,
	shop: shop ? { shopId: id, name: shop, avatarUrl: null } : null,
})

const scheme = {
	version: 1,
	boundary: [],
	blocks: [],
	passages: [],
	entrances: [],
	rows: [
		{ id: 1, code: '14', label: 'Ряд 14', type: 'ROW', geometry: {}, containers: [cell(10, 12), cell(11, 13, 'Toyota Центр')] },
		{ id: 2, code: '1', label: 'Ряд 1', type: 'ROW', geometry: {}, containers: [cell(20, 4)] },
		{ id: 3, code: 'Х', label: 'Ряд Х', type: 'VROW', geometry: {}, containers: [cell(30, 5)] },
		{ id: 4, code: 'Жайма 2', label: 'Жайма 2', type: 'STALL', geometry: {}, containers: [cell(40, 7)] },
		{ id: 5, code: '2', label: 'Ряд 2', type: 'ROW', geometry: {}, containers: [cell(50, 7)] },
	],
} as unknown as MarketScheme

const ids = (q: string) => searchMarket(scheme, q).map((hit) => (hit.kind === 'row' ? `ряд ${hit.rowCode}` : `${hit.rowCode}/${hit.container.number}`))

describe('поиск на карте рынка', () => {
	it('ряд и контейнер цифрами и словами', () => {
		expect(ids('14 12')).toEqual(['14/12'])
		expect(ids('Ряд 14, конт. 12')).toEqual(['14/12'])
		expect(ids('ряд14 конт12')).toEqual(['14/12'])
	})
	it('ряд целиком', () => {
		expect(ids('14')).toEqual(['ряд 14'])
		expect(ids('ряд х')).toEqual(['ряд Х'])
	})
	it('латиница вместо кириллицы', () => {
		expect(ids('x 5')).toEqual(['Х/5'])
	})
	it('жайма — не путать с рядом 2', () => {
		expect(ids('жайма 2 7')).toEqual(['Жайма 2/7'])
		expect(ids('2 7')).toEqual(['2/7'])
	})
	it('магазин по названию', () => {
		expect(ids('тойота')).toEqual([])
		expect(ids('toyota')).toEqual(['14/13'])
	})
	it('нет такого контейнера — пусто', () => {
		expect(ids('14 99')).toEqual([])
	})
})

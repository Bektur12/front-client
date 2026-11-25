import type { PackMaster } from '@/api/types'
import { distanceMeters, formatRoadDistance, rankMasters, roadsideSmsText, worksWith } from './roadside'

// the Too-Ashuu pass on the Bishkek–Osh road
const PASS = { lat: 42.335, lng: 73.807 }

function master(id: number, lat: number, lng: number, radiusKm: number, services: string[], extra: Partial<PackMaster> = {}): PackMaster {
	return {
		id,
		name: `Мастер ${id}`,
		phone: `+99670000010${id}`,
		lat,
		lng,
		address: 'трасса',
		services,
		mobile: true,
		radiusKm,
		rating: 0,
		reviewsCount: 0,
		allBrands: false,
		brandIds: [1],
		origins: ['JAPAN'],
		...extra,
	}
}

describe('roadside', () => {
	it('distance like the backend', () => {
		// ~1 km north in Bishkek
		expect(distanceMeters(42.845, 74.625, 42.854, 74.625)).toBeGreaterThan(990)
		expect(distanceMeters(42.845, 74.625, 42.854, 74.625)).toBeLessThan(1010)
		expect(distanceMeters(1, 1, 1, 1)).toBe(0)
	})

	it('nearest first, those who reach you before the rest, no cut by radius', () => {
		const masters = [
			master(1, 42.87, 74.59, 30, ['TOW_TRUCK']), // Bishkek ~87 km, radius 30 — does not reach
			master(2, 42.81, 73.85, 200, ['TOW_TRUCK']), // Sosnovka ~53 km, radius 200 — reaches
			master(3, 42.35, 73.8, 5, ['TIRE_SERVICE']), // at the pass, other service
			master(4, 42.33, 73.81, 5, ['TOW_TRUCK']), // at the pass — reaches
			master(5, 42.335, 73.807, 50, ['TOW_TRUCK']), // my own profile
		]
		const found = rankMasters(masters, PASS, { service: 'TOW_TRUCK', excludeId: 5 })
		expect(found.map((item) => item.master.id)).toEqual([4, 2, 1])
		expect(found[2].reachesYou).toBe(false)
		expect(found[2].distanceM).toBeGreaterThan(50_000)
		expect(found.every((item) => item.worksWithCar === null)).toBe(true)
	})

	it('a master who does not take the car goes after those who do', () => {
		const near = master(1, 42.336, 73.808, 50, ['CAR_REPAIR'], { brandIds: [2] })
		const far = master(2, 42.4, 73.9, 50, ['CAR_REPAIR'])
		const found = rankMasters([near, far], PASS, { car: { brandId: 1, origin: 'JAPAN' } })
		expect(found.map((item) => item.master.id)).toEqual([2, 1])
		expect(found[1].worksWithCar).toBe(false)
	})

	it('brand and country like Master.worksWith', () => {
		const m = { allBrands: false, brandIds: [1], origins: ['JAPAN'] as PackMaster['origins'] }
		expect(worksWith(m, { brandId: 1, origin: 'JAPAN' })).toBe(true)
		expect(worksWith(m, { brandId: 1, origin: 'UNKNOWN' })).toBe(true)
		expect(worksWith(m, { brandId: 1, origin: 'USA' })).toBe(false)
		expect(worksWith(m, { brandId: 2, origin: 'JAPAN' })).toBe(false)
		expect(worksWith({ allBrands: true, brandIds: [], origins: [] }, { brandId: 99, origin: 'USA' })).toBe(true)
	})

	it('road distances', () => {
		expect(formatRoadDistance(850)).toBe('850 м')
		expect(formatRoadDistance(1240)).toBe('1,2 км')
		expect(formatRoadDistance(85_400)).toBe('85 км')
	})

	it('the SMS carries the car, the service and the point', () => {
		const text = roadsideSmsText({
			serviceName: 'Эвакуатор',
			carLabel: 'Toyota Camry · 2012',
			point: { lat: 42.335123, lng: 73.807311, accuracyM: 31.4, at: new Date(2026, 10, 15, 14, 5) },
		})
		expect(text).toContain('Сломалась машина: Toyota Camry · 2012.')
		expect(text).toContain('Нужен: Эвакуатор.')
		expect(text).toContain('Я здесь: 42.33512, 73.80731 (точность 31 м, 14:05)')
		expect(text).toContain('https://2gis.kg/geo/73.80731,42.33512')
	})
})

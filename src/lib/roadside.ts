// Roadside help without internet: on the Bishkek–Osh road (Too-Ashuu, Ala-Bel) there is often no mobile data,
// but GPS, calls and SMS work. The master directory lives on the phone; distance and order are computed here,
// the same way the backend does it for GET /roadside/nearby (RoadsideService.rank).

import { Platform } from 'react-native'
import type { CarOrigin, PackMaster } from '@/api/types'
import { t } from '@/i18n'

const EARTH_RADIUS_M = 6_371_000
const RAD = Math.PI / 180

/** Straight-line distance in metres (haversine) — as `Distances.meters` on the backend. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
	const dLat = (lat2 - lat1) * RAD
	const dLng = (lng2 - lng1) * RAD
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2
	return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a))))
}

/** The car for «берётся за вашу машину»: brand and country; null — not chosen. */
export interface RoadsideCar {
	brandId: number
	origin?: CarOrigin | null
}

/** As `Master.worksWith`: the brand is his (or «все марки»), the country is his (or his list is empty, or unknown). */
export function worksWith(master: Pick<PackMaster, 'allBrands' | 'brandIds' | 'origins'>, car: RoadsideCar) {
	const brand = master.allBrands || master.brandIds.includes(car.brandId)
	const origin = car.origin
	const country = master.origins.length === 0 || !origin || origin === 'UNKNOWN' || master.origins.includes(origin)
	return brand && country
}

export interface RankedMaster {
	master: PackMaster
	distanceM: number
	/** The client is inside the master's radius — he said he drives this far. */
	reachesYou: boolean
	/** null — no car given. */
	worksWithCar: boolean | null
}

/**
 * «Кто рядом» from the saved directory: only this service (null — any), no cut by radius — the nearest tow
 * truck 100 km away is still listed. First those who reach you and take your car, then by distance.
 */
export function rankMasters(
	masters: PackMaster[],
	point: { lat: number; lng: number },
	options: { service?: string | null; car?: RoadsideCar | null; excludeId?: number | null; limit?: number } = {},
): RankedMaster[] {
	const { service, car, excludeId, limit = 30 } = options
	return masters
		.filter((master) => master.services.length > 0 && master.id !== excludeId)
		.filter((master) => !service || master.services.includes(service))
		.map((master) => {
			const distanceM = distanceMeters(point.lat, point.lng, master.lat, master.lng)
			return {
				master,
				distanceM,
				reachesYou: distanceM <= master.radiusKm * 1000,
				worksWithCar: car ? worksWith(master, car) : null,
			}
		})
		.sort((a, b) => Number(!first(a)) - Number(!first(b)) || a.distanceM - b.distanceM)
		.slice(0, limit)
}

const first = (item: Pick<RankedMaster, 'reachesYou' | 'worksWithCar'>) => item.reachesYou && item.worksWithCar !== false

/** «850 м», «1,2 км»; from 10 km — whole: «85 км» (the push to the master says the same). */
export function formatRoadDistance(meters: number) {
	if (meters < 1000) return t('{0} м', Math.max(10, Math.round(meters / 10) * 10))
	if (meters >= 10_000) return t('{0} км', Math.round(meters / 1000))
	return t('{0} км', (meters / 1000).toFixed(1).replace('.', ','))
}

/** Coordinates as a person dictates them on the phone: «42.33512, 73.80731». */
export function formatCoords(point: { lat: number; lng: number }) {
	return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`
}

/** 2GIS opens on the master's phone once he has internet; the coordinates in the text work without it. */
export function mapLink(point: { lat: number; lng: number }) {
	return `https://2gis.kg/geo/${point.lng.toFixed(5)},${point.lat.toFixed(5)}`
}

/** The SMS to the master — the whole message lives in the text: car, what is needed, where I am and since when. */
export function roadsideSmsText(input: {
	serviceName?: string | null
	carLabel?: string | null
	point?: { lat: number; lng: number; accuracyM?: number | null; at?: Date | null } | null
}) {
	const lines = [t('Здравствуйте! Нашёл вас в приложении «Кудайберген».')]
	lines.push(input.carLabel ? t('Сломалась машина: {0}.', input.carLabel) : t('Сломалась машина.'))
	if (input.serviceName) lines.push(t('Нужен: {0}.', input.serviceName))
	const point = input.point
	if (point) {
		const details = [
			point.accuracyM ? t('точность {0} м', Math.round(point.accuracyM)) : null,
			point.at ? `${String(point.at.getHours()).padStart(2, '0')}:${String(point.at.getMinutes()).padStart(2, '0')}` : null,
		].filter(Boolean)
		lines.push(t('Я здесь: {0}', formatCoords(point)) + (details.length ? ` (${details.join(', ')})` : ''))
		lines.push(mapLink(point))
	}
	return lines.join('\n')
}

/** `sms:` link with a prefilled body: iOS separates it with «&», Android with «?». */
export function smsUrl(phone: string, body: string) {
	return `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`
}

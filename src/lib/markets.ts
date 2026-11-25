import { t } from '@/i18n'

/** Codes from GET /market/markets. */
export type MarketCode = 'KUDAIBERGEN' | 'GEOLOGIYA' | 'DORDOI_MOTORS' | 'DORDOI'

export interface MarketLook {
	/** Fill of the letter tile, the active chip and the buttons. */
	color: string
	/** Soft background of the market header. */
	tint: string
	/** Text on the tint. */
	ink: string
	/** «К», «Г», «ДМ», «Д». */
	letter: string
	address: string
	/** «600 м от Кудайбергена» — the three car markets stand next to each other. */
	near?: string
	/** [lon, lat] for «Маршрут» (2GIS) — the market's centre, from OpenStreetMap. */
	point: [number, number]
}

/**
 * One color and letter per market, the same everywhere: the «Рынок» tab, «Рынки», the catalog filter.
 * Addresses and points — from OpenStreetMap (the backend has no points for most markets yet).
 */
export const MARKET_LOOK: Record<MarketCode, MarketLook> = {
	KUDAIBERGEN: { color: '#2155E6', tint: '#EDF2FF', ink: '#1D46BF', letter: 'К', address: t('ул. Патриса Лумумбы'), point: [74.523028, 42.881512] },
	GEOLOGIYA: { color: '#E07B00', tint: '#FFF3E2', ink: '#9A5300', letter: 'Г', address: t('ул. Профсоюзная'), near: t('600 м от Кудайбергена'), point: [74.520709, 42.886242] },
	DORDOI_MOTORS: { color: '#0F9D58', tint: '#E6F6EE', ink: '#08703E', letter: 'ДМ', address: t('ул. Патриса Лумумбы, 302'), near: t('1 км от Кудайбергена'), point: [74.528546, 42.872913] },
	DORDOI: { color: '#7A4DE0', tint: '#F2EDFF', ink: '#5530B0', letter: 'Д', address: t('ул. Жанбо уулу Кадыке'), point: [74.620484, 42.938564] },
}

/** A market the app doesn't know yet (added on the server later) — neutral, still readable. */
const FALLBACK: MarketLook = { color: '#5A6880', tint: '#F4F5F7', ink: '#3A3F47', letter: '•', address: '', point: [74.6, 42.87] }

export function marketLook(code: string | null | undefined): MarketLook {
	return (code && MARKET_LOOK[code as MarketCode]) || FALLBACK
}

/**
 * Markets work Tue–Sun 9:00–17:00, Monday is the day off (the backend's default for market shops).
 * Bishkek time (UTC+6) whatever the phone's time zone.
 */
export function marketHours(now = new Date()) {
	const bishkek = new Date(now.getTime() + (now.getTimezoneOffset() + 6 * 60) * 60_000)
	const day = bishkek.getDay()
	const minutes = bishkek.getHours() * 60 + bishkek.getMinutes()
	const open = day !== 1 && minutes >= 9 * 60 && minutes < 17 * 60
	if (open) return { open, label: t('Открыто до 17:00') }
	if (day === 1) return { open, label: t('Сегодня выходной, откроется во вторник') }
	if (minutes < 9 * 60) return { open, label: t('Откроется в 9:00') }
	// Sunday evening — Monday is the day off
	return { open, label: day === 0 ? t('Закрыто, откроется во вторник') : t('Закрыто, откроется завтра в 9:00') }
}

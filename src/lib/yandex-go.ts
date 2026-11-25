import { Linking } from 'react-native'

// Яндекс Go — курьер прямо сейчас: открываем приложение с готовым маршрутом «контейнер продавца → покупатель».
// Ссылка AppMetrica сама решает: приложение стоит — откроет его, нет — App Store / Google Play.
// Заказ и оплата — внутри Яндекс Go, к нашему серверу он не привязан.

/** Публичный tracking id из документации Яндекс Go «Ссылки на приложение». */
const TRACKING_ID = '1178268795219780156'

export interface Point {
	lat: number
	lon: number
}

/**
 * Тариф — параметр `tariffClass` (yandex.ru/support/taxi-distr/ru/api/deeplinks.html), значения как в API:
 * `express` — «Доставка», `courier` — «Курьер» (до 10 кг). Работает, только если задана хотя бы одна точка маршрута.
 */
const DELIVERY_TARIFF = 'express'

export function yandexGoUrl(from?: Point | null, to?: Point | null) {
	const params: [string, string | number][] = []
	if (from) params.push(['start-lat', from.lat], ['start-lon', from.lon])
	if (to) params.push(['end-lat', to.lat], ['end-lon', to.lon])
	params.push(['tariffClass', DELIVERY_TARIFF], ['ref', 'kudaiberdi'], ['appmetrica_tracking_id', TRACKING_ID])
	// URLSearchParams в React Native урезан — собираем строку сами
	const query = params.map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')
	return `https://3.redirect.appmetrica.yandex.com/route?${query}`
}

export function openYandexGo(from?: Point | null, to?: Point | null) {
	return Linking.openURL(yandexGoUrl(from, to))
}

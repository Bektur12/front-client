import { useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import * as Location from 'expo-location'

export interface LiveFix {
	lat: number
	lon: number
	/** Точность, м. */
	accuracy: number | null
}

/** Расстояние между точками, м (на масштабе рынка плоской Земли хватает). */
export function metersBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
	const k = Math.PI / 180
	const dx = (b.lon - a.lon) * k * Math.cos(((a.lat + b.lat) / 2) * k) * 6_371_000
	const dy = (b.lat - a.lat) * k * 6_371_000
	return Math.hypot(dx, dy)
}

/**
 * Где человек — вживую, пока экран открыт: спрашивает разрешение и следит за позицией (каждые ~3 м / 2 с).
 * Отказ или ошибка — null, экран работает без геолокации (маршрут от входа).
 */
export function useLiveLocation(enabled = true): LiveFix | null {
	const [fix, setFix] = useState<LiveFix | null>(null)
	useEffect(() => {
		if (!enabled) return
		if (Platform.OS === 'web') {
			// expo-location на вебе теряет события watchPosition (подменяет номер подписки номером браузера) — берём у браузера сами
			if (!('geolocation' in navigator)) return
			const id = navigator.geolocation.watchPosition(
				({ coords }) => setFix({ lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy ?? null }),
				undefined,
				{ enableHighAccuracy: true, maximumAge: 2000 },
			)
			return () => navigator.geolocation.clearWatch(id)
		}
		let alive = true
		let subscription: Location.LocationSubscription | null = null
		;(async () => {
			const { status } = await Location.requestForegroundPermissionsAsync()
			if (status !== 'granted' || !alive) return
			subscription = await Location.watchPositionAsync(
				{ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, timeInterval: 2000 },
				({ coords }) => {
					if (alive) setFix({ lat: coords.latitude, lon: coords.longitude, accuracy: coords.accuracy ?? null })
				},
			)
			if (!alive) subscription.remove()
		})().catch(() => {})
		return () => {
			alive = false
			subscription?.remove()
		}
	}, [enabled])
	return fix
}

/**
 * Точка, от которой строить маршрут: меняется, только когда человек ушёл дальше `step` метров от прошлой —
 * маршрут пересчитывается на ходу, но не на каждый шаг и не от дрожания GPS.
 */
export function useSteadyOrigin(fix: LiveFix | null, step = 12): { lat: number; lon: number } | null {
	const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null)
	const last = useRef<{ lat: number; lon: number } | null>(null)
	useEffect(() => {
		if (!fix) return
		// грубая точка (точность хуже 80 м) маршрут не двигает — разве что это первая
		if (last.current && fix.accuracy != null && fix.accuracy > 80) return
		if (!last.current || metersBetween(last.current, fix) >= step) {
			last.current = { lat: fix.lat, lon: fix.lon }
			setOrigin(last.current)
		}
	}, [fix, step])
	return origin
}

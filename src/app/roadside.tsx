import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Location from 'expo-location'
import * as Clipboard from 'expo-clipboard'
import { Chip, ScreenHeader, ServiceBadge, toast } from '@/components/ui'
import { LocateIcon, MapPinIcon, PhoneIcon, SendIcon } from '@/components/icons'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { haptic } from '@/lib/haptics'
import { formatDay, formatClock } from '@/lib/format'
import { open2gis } from '@/lib/shop-place'
import { formatCoords, formatRoadDistance, rankMasters, roadsideSmsText, smsUrl } from '@/lib/roadside'
import { useNearbyMasters } from '@/api/roadside'
import { useCars } from '@/api/garage'
import { useSignedIn } from '@/api/catalog'
import { serviceName, useServiceTypes } from '@/api/services'
import { PACK_STALE_MS, useRoadsidePack } from '@/store/useRoadsidePack'
import { requireSignIn } from '@/components/sign-in-prompt'
import type { EmergencyNumber } from '@/api/types'
import { getAppLang, t } from '@/i18n'

/** Chips in the order a broken-down driver needs them; null — everything. */
const SERVICES: (string | null)[] = ['TOW_TRUCK', 'MOBILE_MASTER', 'TIRE_SERVICE', 'CAR_REPAIR', 'AUTO_ELECTRIC', null]

/** Before the first download of the directory — always on screen, even for a guest. */
const BUNDLED_EMERGENCY: EmergencyNumber[] = [
	{ number: '112', nameRu: 'Единая служба спасения', nameKg: 'Бирдиктүү куткаруу кызматы' },
	{ number: '103', nameRu: 'Скорая помощь', nameKg: 'Тез жардам' },
	{ number: '102', nameRu: 'Милиция', nameKg: 'Милиция' },
	{ number: '101', nameRu: 'Пожарная служба', nameKg: 'Өрт өчүрүү кызматы' },
]

interface Point {
	lat: number
	lng: number
	accuracyM: number | null
	at: Date
}

type GpsState = 'searching' | 'fixed' | 'denied' | 'failed'

/** A fresh fix without internet (no A-GPS) may take a while on a mountain road. */
const GPS_TIMEOUT_MS = 30_000

/** Where the phone is: the last known point at once (any age — its time is shown), then a fresh fix. */
function useRoadsidePoint() {
	const [point, setPoint] = useState<Point | null>(null)
	const [state, setState] = useState<GpsState>('searching')
	const [attempt, setAttempt] = useState(0)

	useEffect(() => {
		let alive = true
		const take = (position: Location.LocationObject) =>
			alive &&
			setPoint({
				lat: position.coords.latitude,
				lng: position.coords.longitude,
				accuracyM: position.coords.accuracy ?? null,
				at: new Date(position.timestamp),
			})
		;(async () => {
			setState('searching')
			const permission = await Location.requestForegroundPermissionsAsync().catch(() => null)
			if (!permission?.granted) {
				if (alive) setState('denied')
				return
			}
			const last = await Location.getLastKnownPositionAsync().catch(() => null)
			if (last) take(last)
			const fresh = await Promise.race([
				Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null),
				new Promise<null>((resolve) => setTimeout(() => resolve(null), GPS_TIMEOUT_MS)),
			])
			if (fresh) take(fresh)
			if (alive) setState(fresh || last ? 'fixed' : 'failed')
		})()
		return () => {
			alive = false
		}
	}, [attempt])

	return { point, state, retry: () => setAttempt((n) => n + 1) }
}

/** One row of «Кто рядом» — from the server or from the saved directory. */
interface Row {
	id: number
	name: string
	phone: string | null
	lat: number
	lng: number
	address: string
	rating: number
	reviewsCount: number
	services: string[]
	distanceM: number
	reachesYou: boolean
	worksWithCar: boolean | null
}

/**
 * «Помощь на дороге»: the nearest masters, tyre shops and tow trucks right away, with «Позвонить» and «SMS».
 * Without internet (the Bishkek–Osh passes) — the directory saved on the phone, distance by GPS.
 */
export default function RoadsideScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const params = useLocalSearchParams<{ service?: string }>()
	const [service, setService] = useState<string | null>(params.service ?? 'TOW_TRUCK')
	const signedIn = useSignedIn()
	const types = useServiceTypes().data
	const cars = useCars(signedIn)
	const car = cars.data?.find((item) => item.isPrimary) ?? cars.data?.[0]
	const gps = useRoadsidePoint()
	// «Сейчас» for the staleness check — fixed when the screen opens, not on every render.
	const [openedAt] = useState(() => Date.now())
	const { pack, savedAt, syncing, load, sync } = useRoadsidePack()

	useEffect(() => {
		load().then(() => sync())
	}, [load, sync])

	const online = useNearbyMasters({
		point: gps.point,
		service,
		carId: car?.id,
		enabled: signedIn,
	})

	// The server list when it answered; otherwise the saved directory ranked here, the same way.
	const offline = !online.data && (online.isError || !signedIn)
	const rows: Row[] = useMemo(() => {
		if (online.data) {
			return online.data.map((item) => ({
				id: item.master.id,
				name: item.master.name,
				phone: item.master.phone,
				lat: item.master.lat,
				lng: item.master.lng,
				address: item.master.address,
				rating: Number(item.master.rating),
				reviewsCount: item.master.reviewsCount,
				services: item.services,
				distanceM: item.distanceM,
				reachesYou: item.reachesYou,
				worksWithCar: item.worksWithCar ?? null,
			}))
		}
		if (!pack) return []
		if (!gps.point) {
			// No point at all — the whole directory by name, chips still filter.
			return pack.masters
				.filter((m) => !service || m.services.includes(service))
				.sort((a, b) => a.name.localeCompare(b.name))
				.slice(0, 50)
				.map((m) => ({ ...m, rating: Number(m.rating), distanceM: -1, reachesYou: false, worksWithCar: null }))
		}
		return rankMasters(pack.masters, gps.point, {
			service,
			car: car ? { brandId: car.brand.id, origin: car.origin } : null,
		}).map(({ master, ...rest }) => ({ ...master, rating: Number(master.rating), ...rest }))
	}, [online.data, pack, gps.point, service, car])

	const loading = !online.data && online.isFetching && rows.length === 0
	const stale = !savedAt || openedAt - savedAt > PACK_STALE_MS
	const emergency = pack?.emergency?.length ? pack.emergency : BUNDLED_EMERGENCY
	const label = (code: string | null) => (code ? serviceName(types, code, true) : t('Все'))
	const carLabel = car ? `${car.title} · ${car.year}` : null

	const sendSms = (row: Row) => {
		if (!row.phone) return
		haptic.select()
		const body = roadsideSmsText({ serviceName: service ? serviceName(types, service) : null, carLabel, point: gps.point })
		Linking.openURL(smsUrl(row.phone, body)).catch(() => toast(t('Не удалось открыть SMS')))
	}

	const call = (phone: string) => {
		haptic.select()
		Linking.openURL(`tel:${phone}`).catch(() => toast(t('Не удалось позвонить')))
	}

	const copyCoords = async () => {
		if (!gps.point) return
		await Clipboard.setStringAsync(formatCoords(gps.point))
		toast(t('Координаты скопированы'))
	}

	return (
		<View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
			<ScreenHeader title={t('Помощь на дороге')} />

			<ScrollView
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 + insets.bottom, gap: 12 }}
				refreshControl={
					<RefreshControl
						refreshing={syncing || (online.isFetching && Boolean(online.data))}
						onRefresh={() => {
							gps.retry()
							online.refetch()
							sync({ force: true })
						}}
						tintColor={c.muted}
					/>
				}
			>
				{/* Where I am — the point the masters and the SMS get. */}
				<Pressable
					onPress={gps.state === 'denied' ? () => Linking.openSettings() : gps.point ? copyCoords : gps.retry}
					style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: c.card, paddingVertical: 12, paddingHorizontal: 14 }}
				>
					{gps.state === 'searching' && !gps.point ? <ActivityIndicator color={c.brandStrong} /> : <LocateIcon size={20} color={c.brandStrong} />}
					<View style={{ flex: 1, gap: 2 }}>
						<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: c.ink }}>
							{gps.point
								? formatCoords(gps.point)
								: gps.state === 'denied'
									? t('Включите геолокацию')
									: gps.state === 'failed'
										? t('Не удалось определить место')
										: t('Ищем вас по GPS…')}
						</Text>
						<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(400), color: c.muted }}>
							{gps.point
								? [
										gps.point.accuracyM ? t('точность {0} м', Math.round(gps.point.accuracyM)) : null,
										formatClock(gps.point.at),
										gps.state === 'searching' ? t('уточняем…') : t('нажмите, чтобы скопировать'),
									]
										.filter(Boolean)
										.join(' · ')
								: gps.state === 'denied'
									? t('Откройте настройки — GPS работает и без интернета')
									: gps.state === 'failed'
										? t('Нажмите, чтобы попробовать ещё раз')
										: t('Без интернета GPS ловит дольше — до минуты')}
						</Text>
					</View>
				</Pressable>

				{offline && pack ? (
					<Notice tone="warning" text={t('Нет интернета — показаны сохранённые мастера (обновлено {0}, {1})', formatDay(new Date(savedAt ?? openedAt)), formatClock(new Date(savedAt ?? openedAt)))} />
				) : null}
				{!pack && offline ? (
					<Notice tone="danger" text={t('Нет интернета, а справочник мастеров ещё не скачан. Звоните в экстренные службы ниже.')} />
				) : null}
				{pack && stale && !offline ? (
					<Notice
						tone="warning"
						text={t('Перед дальней дорогой обновите справочник мастеров — он работает без интернета')}
						action={syncing ? undefined : { label: t('Обновить'), onPress: () => sync({ force: true }) }}
					/>
				) : null}
				{!signedIn ? (
					<Notice
						tone="warning"
						text={t('Войдите, чтобы видеть мастеров рядом и сохранить справочник на телефон')}
						action={{ label: t('Войти'), onPress: () => requireSignIn() }}
					/>
				) : null}

				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
					{SERVICES.map((code) => (
						<Chip key={code ?? 'ALL'} label={label(code)} height={40} radius={20} selected={service === code} onPress={() => setService(code)} />
					))}
				</ScrollView>

				{loading ? (
					<View style={{ paddingVertical: 32, alignItems: 'center' }}>
						<ActivityIndicator color={c.brandStrong} />
					</View>
				) : rows.length === 0 ? (
					<Text style={{ fontSize: fs.base, fontFamily: fontFamily(400), color: c.muted, textAlign: 'center', paddingVertical: 24 }}>
						{pack || online.data ? t('Никого с этой услугой — выберите другую') : t('Мастера появятся, когда будет интернет')}
					</Text>
				) : (
					rows.map((row) => (
						<View key={row.id} style={{ borderRadius: 16, backgroundColor: c.card, padding: 14, gap: 10 }}>
							<Pressable onPress={() => !offline && router.push({ pathname: '/master-card', params: { id: String(row.id) } })} style={{ flexDirection: 'row', gap: 12 }}>
								<ServiceBadge code={(service ?? row.services[0]) || 'CAR_REPAIR'} size={40} />
								<View style={{ flex: 1, gap: 3 }}>
									<Text numberOfLines={1} style={{ fontSize: fs.lg, fontFamily: fontFamily(700), color: c.ink }}>
										{row.name}
									</Text>
									<Text numberOfLines={1} style={{ fontSize: fs.sm, fontFamily: fontFamily(400), color: c.muted }}>
										{[
											row.distanceM >= 0 ? t('{0} от вас', formatRoadDistance(row.distanceM)) : null,
											row.reviewsCount > 0 ? `★ ${row.rating.toFixed(1)} · ${row.reviewsCount}` : null,
											row.services.map((code) => serviceName(types, code, true)).join(', '),
										]
											.filter(Boolean)
											.join(' · ')}
									</Text>
									<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
										{row.reachesYou ? <Tag text={t('Доедет к вам')} color={c.successInk} background={c.successSoft} /> : null}
										{row.worksWithCar === false ? <Tag text={t('Не ваша марка')} color={c.muted} background={c.surface} /> : null}
									</View>
								</View>
							</Pressable>
							<View style={{ flexDirection: 'row', gap: 8 }}>
								<Pressable
									disabled={!row.phone}
									onPress={() => row.phone && call(row.phone)}
									style={{ flex: 2, height: 48, borderRadius: 12, backgroundColor: c.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: row.phone ? 1 : 0.4 }}
								>
									<PhoneIcon size={18} color={fixed.white} />
									<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: fixed.white }}>{t('Позвонить')}</Text>
								</Pressable>
								<Pressable
									disabled={!row.phone}
									onPress={() => sendSms(row)}
									style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
								>
									<SendIcon size={16} color={c.ink} />
									<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: c.ink }}>SMS</Text>
								</Pressable>
								<Pressable
									accessibilityLabel={t('Маршрут')}
									onPress={() => open2gis(row)}
									style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
								>
									<MapPinIcon size={18} color={c.ink} />
								</Pressable>
							</View>
						</View>
					))
				)}

				{!offline && signedIn && service ? (
					<Pressable
						onPress={() => router.push({ pathname: '/service-new', params: { service } })}
						style={{ height: 52, borderRadius: 14, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
					>
						<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('Не дозвонились? Отправить заявку всем рядом')}</Text>
					</Pressable>
				) : null}

				<View style={{ gap: 8, marginTop: 4 }}>
					<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: c.inkSecondary }}>{t('Экстренные службы')}</Text>
					<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
						{emergency.map((item) => (
							<Pressable
								key={item.number}
								onPress={() => call(item.number)}
								style={{ flexGrow: 1, flexBasis: '45%', borderRadius: 12, backgroundColor: c.dangerSoft, paddingVertical: 10, paddingHorizontal: 12 }}
							>
								<Text style={{ fontSize: fs.xxl, fontFamily: fontFamily(700), color: c.danger }}>{item.number}</Text>
								<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(400), color: c.inkSecondary }}>{getAppLang() === 'ky' ? item.nameKg : item.nameRu}</Text>
							</Pressable>
						))}
					</View>
				</View>
			</ScrollView>
		</View>
	)
}

function Tag({ text, color, background }: { text: string; color: string; background: string }) {
	return (
		<View style={{ borderRadius: 8, backgroundColor: background, paddingVertical: 3, paddingHorizontal: 8 }}>
			<Text style={{ fontSize: fs.xs, fontFamily: fontFamily(700), color }}>{text}</Text>
		</View>
	)
}

function Notice({ text, tone, action }: { text: string; tone: 'warning' | 'danger'; action?: { label: string; onPress: () => void } }) {
	const c = useColors()
	const color = tone === 'danger' ? c.danger : c.warningInk
	return (
		<View style={{ borderRadius: 14, backgroundColor: tone === 'danger' ? c.dangerSoft : c.warningTint, paddingVertical: 12, paddingHorizontal: 14, gap: 8 }}>
			<Text style={{ fontSize: fs.md, fontFamily: fontFamily(600), color }}>{text}</Text>
			{action ? (
				<Pressable onPress={action.onPress} hitSlop={8}>
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}>{action.label}</Text>
				</Pressable>
			) : null}
		</View>
	)
}

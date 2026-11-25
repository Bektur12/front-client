import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { MarketMapLive, type MarketMapLiveHandle } from '@/components/market-map-live'
import { PlacePlate, QueryErrorBanner, ScreenHeader } from '@/components/ui'
import { LinearGradient } from 'expo-linear-gradient'
import { BigButton, BubbleIcon, CallIcon, ChevronIcon, RouteIcon } from '@/components/buyer-v23'
import { LocateIcon } from '@/components/icons'
import { schemaToGeo } from '@/lib/geo'
import { fixed, fontFamily, fs, LightTheme, raw, useColors } from '@/theme'
import { StatusBar } from 'expo-status-bar'
import { formatPlace } from '@/lib/format'
import { useRoute } from '@/api/market'
import { useLiveLocation, useSteadyOrigin } from '@/lib/use-live-location'
import { t } from '@/i18n'

/** Карта всегда светлая — и экран вокруг неё тоже, даже в тёмной теме телефона. */
export default function RouteScreen() {
	return (
		<LightTheme>
			<StatusBar style="dark" />
			<RouteScreenContent />
		</LightTheme>
	)
}

function RouteScreenContent() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const params = useLocalSearchParams<{ containerId: string; shopName?: string; chatId?: string; phone?: string }>()
	const chatId = Number(params.chatId) || 0
	// геолокация вживую: маршрут пересчитывается, когда человек прошёл ~12 м (на рынке и на подходе к нему)
	const live = useLiveLocation()
	const origin = useSteadyOrigin(live)
	const route = useRoute(Number(params.containerId) || 0, origin)
	const mapRef = useRef<MarketMapLiveHandle>(null)
	const data = route.data
	const polyline = data?.polyline

	const [sheetHeight, setSheetHeight] = useState(0)
	const containerPoint = data?.containerPoint

	/** Весь путь от старта до контейнера — над шторкой, под заголовком. */
	const showWholeRoute = useCallback(() => {
		if (!polyline?.length) return
		const points = [...polyline, ...(containerPoint ? [containerPoint] : [])].map(([x, y]) => schemaToGeo(x, y))
		mapRef.current?.fitTo(points, { top: insets.top + 80, bottom: sheetHeight + 24, left: 48, right: 48 })
	}, [polyline, containerPoint, insets.top, sheetHeight])

	// весь путь — один раз, когда он впервые построен; дальше маршрут обновляется на ходу, а камерой управляет человек
	const framed = useRef(false)
	useEffect(() => {
		if (framed.current || !sheetHeight || !polyline?.length) return
		framed.current = true
		showWholeRoute()
	}, [showWholeRoute, sheetHeight, polyline])

	const minutes = data ? Math.max(1, data.minutes) : null
	/** Единственная подсказка — про финал: по какую руку контейнер (последний шаг маршрута). */
	const arrive = data?.steps?.at(-1)?.text ?? ''
	const rightHand = /правую|оң жагыңызда/.test(arrive)
	const leftHand = /левую|сол жагыңызда/.test(arrive)

	return (
		<View style={{ flex: 1, backgroundColor: raw.mapSurface }}>
			<MarketMapLive
				ref={mapRef}
				route={data?.polyline}
				highlightedRowIds={data ? [data.target.rowId] : undefined}
				targetContainerId={Number(params.containerId) || undefined}
				onContainerPress={(_, shopId) => shopId && router.push({ pathname: '/seller-profile', params: { id: String(shopId) } })}
			/>

			{/* «Где я» и «Весь путь» — над шторкой справа */}
			{sheetHeight > 0 ? (
				<View style={{ position: 'absolute', right: 14, bottom: sheetHeight + 14, gap: 10 }}>
					<MapRoundButton label={t('Где я')} onPress={() => mapRef.current?.focusOnMe(18.5)}>
						<LocateIcon size={22} color={c.ink} />
					</MapRoundButton>
					<MapRoundButton label={t('Весь путь')} onPress={showWholeRoute}>
						<RouteIcon size={22} color={c.ink} />
					</MapRoundButton>
				</View>
			) : null}

			<LinearGradient
				colors={[c.surface, c.surface, c.surfaceClear]}
				locations={[0, 0.6, 1]}
				pointerEvents="none"
				style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 60 }}
			/>
			<View style={{ position: 'absolute', left: 0, right: 0, top: insets.top }}>
				<ScreenHeader title={t('Как пройти')} />
			</View>

			<View
				onLayout={(event) => setSheetHeight(Math.round(event.nativeEvent.layout.height))}
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: c.card,
					borderTopLeftRadius: 24,
					borderTopRightRadius: 24,
					paddingTop: 10,
					paddingHorizontal: 16,
					paddingBottom: Math.max(insets.bottom, 28),
					gap: 12,
					shadowColor: fixed.shadow,
					shadowOpacity: 0.1,
					shadowOffset: { width: 0, height: -8 },
					shadowRadius: 12,
					elevation: 8,
				}}
			>
				<View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center' }} />

				<QueryErrorBanner error={route.error} onRetry={() => route.refetch()} offlineText={t('Нет сети. Маршрут построим, когда появится')} />

				{data ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
						<PlacePlate row={data.target.rowCode} box={data.target.number} size="md" />
						<View style={{ flex: 1, gap: 2 }}>
							<Text numberOfLines={1} style={{ fontSize: fs.xl, fontFamily: fontFamily(700), color: c.ink }}>
								{params.shopName ?? formatPlace(data.target)}
							</Text>
							<Text style={{ fontSize: fs.md, fontFamily: fontFamily(400), color: c.muted }}>
								{t('{0} мин · {1} м', minutes, data.distanceM)}
								{data.fromSource === 'ENTRANCE' ? t(' от входа') : data.fromSource === 'GPS' ? t(' от вас') : ''}
							</Text>
						</View>
					</View>
				) : null}

				{/* шагов нет: путь показывает линия на карте; подсказка только про финал */}
				{data && (rightHand || leftHand) ? (
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, backgroundColor: c.surface }}>
						<View style={{ transform: [{ rotate: rightHand ? '0deg' : '180deg' }] }}>
							<ChevronIcon size={20} color={c.ink} />
						</View>
						<Text style={{ flex: 1, fontSize: fs.base, lineHeight: 21, fontFamily: fontFamily(600), color: c.ink }}>
							{rightHand
								? t('Контейнер {0} будет по правую руку', data.target.number)
								: t('Контейнер {0} будет по левую руку', data.target.number)}
						</Text>
					</View>
				) : null}

				<View style={{ flexDirection: 'row', gap: 10 }}>
					<BigButton
						label={t('Позвонить')}
						tone="grey"
						height={52}
						icon={<CallIcon size={20} color={c.ink} strokeWidth={2.4} />}
						disabled={!params.phone}
						onPress={() => params.phone && Linking.openURL(`tel:${params.phone}`)}
						style={{ flex: 1 }}
					/>
					<BigButton
						label={t('Написать')}
						height={52}
						icon={<BubbleIcon size={20} color={fixed.white} strokeWidth={2.4} />}
						disabled={!chatId}
						onPress={() => router.push({ pathname: '/chat', params: { chatId: String(chatId) } })}
						style={{ flex: 1 }}
					/>
				</View>
			</View>
		</View>
	)
}

/** «РЯД 14» / «КОНТ. 12» — blue boxes in the sheet [06]. */

/** Круглая кнопка на карте: «Где я», «Весь путь». */
function MapRoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
	const c = useColors()
	return (
		<Pressable
			accessibilityLabel={label}
			onPress={onPress}
			style={{
				width: 48,
				height: 48,
				borderRadius: 24,
				backgroundColor: c.card,
				alignItems: 'center',
				justifyContent: 'center',
				shadowColor: fixed.shadow,
				shadowOpacity: 0.16,
				shadowOffset: { width: 0, height: 4 },
				shadowRadius: 10,
				elevation: 5,
			}}
		>
			{children}
		</Pressable>
	)
}

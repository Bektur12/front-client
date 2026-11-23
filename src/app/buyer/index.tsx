import { useEffect, useRef, type ComponentType, type ReactNode } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View, type ScrollViewInstance } from 'react-native'
import { Image } from '@/components/ui/image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useScrollToTop } from 'expo-router'
import { resolveUrl } from '@/lib/api'
import { usePullRefresh } from '@/lib/use-pull-refresh'
import { QueryErrorBanner, Skeleton, SkeletonRepeat } from '@/components/ui'
import {
	Caps,
	ChevronIcon,
	LiveDot,
	LoupeIcon,
	MetaChip,
	PlusThinIcon,
	TowIcon,
	WheelIcon,
	WrenchIcon,
} from '@/components/buyer-v23'
import { TruckIcon, deliveryStatusText } from '@/components/video-v23'
import { MarketVideos } from '@/components/market-videos'
import { MarketStrip } from '@/components/market-strip'
import { RecentlyViewed } from '@/components/recently-viewed'
import { MyRequestItem, mergeRequests } from '@/components/my-requests'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { useMe } from '@/api/me'
import { useCars } from '@/api/garage'
import { useMyRequests } from '@/api/requests'
import { flattenPages } from '@/api/pagination'
import { useMyServiceRequests } from '@/api/services'
import { useSignedIn } from '@/api/catalog'
import { useDeliveryOrders } from '@/api/delivery'
import type { DeliveryOrder } from '@/api/types'
import { t } from '@/i18n'
import { requireSignIn } from '@/components/sign-in-prompt'
import { Greeting } from '@/components/greeting'
import { useRoadsidePack } from '@/store/useRoadsidePack'

/** «Нужен мастер?» [03]: three services → the one-screen request [16], «Все услуги» → choose there. */
const HOME_SERVICES: { code: string; label: string; icon: ComponentType<{ size?: number; color: string; strokeWidth?: number }> }[] = [
	{ code: 'CAR_REPAIR', label: t('Ремонт'), icon: WrenchIcon },
	{ code: 'TIRE_SERVICE', label: t('Шиномонтаж'), icon: WheelIcon },
	{ code: 'TOW_TRUCK', label: t('Эвакуатор'), icon: TowIcon },
]

/** Rows shown before «Все». */
const PREVIEW = 3

/** 03 Главная: the car, «Найти запчасть», «Нужен мастер?», «Видео с рынка», parcels on the way, «Мои запросы». */
export default function BuyerHomeScreen() {
	const c = useColors()
	// Tapping the active tab again scrolls back to the top, as in every app.
	const list = useRef<ScrollViewInstance>(null)
	useScrollToTop(list)
	const insets = useSafeAreaInsets()
	const me = useMe()
	const signedIn = useSignedIn()
	const cars = useCars(signedIn)
	const requests = useMyRequests()
	const services = useMyServiceRequests()
	const delivery = useDeliveryOrders('BUYER', signedIn)
	const parcels = delivery.data ?? []
	// refetch() runs even a disabled query — a guest has no parcels to ask for.
	const pull = usePullRefresh(() => [cars.refetch(), requests.refetch(), services.refetch(), signedIn && delivery.refetch()])
	// Parts requests and service requests in one list, newest first.
	const items = mergeRequests(flattenPages(requests.data), flattenPages(services.data))
	const car = cars.data?.find((item) => item.isPrimary) ?? cars.data?.[0]
	const name = me.data?.name
	// Keep the roadside directory fresh while there is internet — it is what helps on a pass without it.
	const syncRoadside = useRoadsidePack((s) => s.sync)
	useEffect(() => {
		if (signedIn) syncRoadside()
	}, [signedIn, syncRoadside])

	return (
		<View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
			<View style={{ minHeight: 68, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
				{/* «Салам, {имя}!» and the car under it. */}
				<Greeting name={name} subtitle={car ? `${car.title} · ${car.year}` : t('Машина не выбрана')} />
			</View>

			<ScrollView
				ref={list}
				contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
				showsVerticalScrollIndicator={false}
				refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={c.muted} />}
			>
				<Pressable onPress={() => requireSignIn() && router.push('/search-part')}>
					<LinearGradient
						colors={fixed.brandGradient}
						start={{ x: 0.25, y: 0 }}
						end={{ x: 0.75, y: 1 }}
						style={{
							height: 108,
							borderRadius: 24,
							paddingHorizontal: 18,
							flexDirection: 'row',
							alignItems: 'center',
							gap: 14,
							overflow: 'hidden',
							shadowColor: fixed.brandShadow,
							shadowOpacity: 0.32,
							shadowOffset: { width: 0, height: 14 },
							shadowRadius: 15,
							elevation: 12,
						}}
					>
						<View
							style={{
								width: 46,
								height: 46,
								borderRadius: 14,
								backgroundColor: 'rgba(255,255,255,0.18)',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<LoupeIcon size={24} color={fixed.white} strokeWidth={2.6} />
						</View>
						<View style={{ flex: 1, gap: 3 }}>
							<Text style={{ fontSize: fs.h3, lineHeight: 29, fontFamily: fontFamily(800), letterSpacing: -0.4, color: fixed.white }}>{t('Найти запчасть')}</Text>
							<Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: 'rgba(255,255,255,0.88)' }}>{t('Фото или голосом — продавцы ответят с ценой')}</Text>
						</View>
					</LinearGradient>
				</Pressable>

				<Caps large>{t('Нужен мастер?')}</Caps>
				<View style={{ flexDirection: 'row', gap: 8 }}>
					{HOME_SERVICES.map(({ code, label, icon: Icon }) => (
						<ServiceTile
							key={code}
							label={label}
							icon={<Icon size={22} color={c.brandStrong} strokeWidth={2} />}
							onPress={() => requireSignIn(t('Чтобы позвать мастера, войдите по номеру телефона.')) && router.push({ pathname: '/service-new', params: { service: code } })}
						/>
					))}
					<ServiceTile
						label={t('Все услуги')}
						muted
						icon={<PlusThinIcon size={22} color={c.ink} />}
						onPress={() => requireSignIn(t('Чтобы позвать мастера, войдите по номеру телефона.')) && router.push('/service-new')}
					/>
				</View>

				{/* Broke down on the road: the nearest tow trucks and masters at once — from the saved directory without internet. */}
				<Pressable
					onPress={() => router.push('/roadside')}
					accessibilityRole="button"
					style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, backgroundColor: c.dangerSoft, paddingVertical: 14, paddingHorizontal: 14 }}
				>
					<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center' }}>
						<TowIcon size={22} color={fixed.white} strokeWidth={2} />
					</View>
					<View style={{ flex: 1, gap: 2 }}>
						<Text style={{ fontSize: fs.lg, fontFamily: fontFamily(700), color: c.danger }}>{t('Сломались в дороге?')}</Text>
						<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(400), color: c.inkSecondary }}>{t('Эвакуатор и мастера рядом — даже без интернета')}</Text>
					</View>
					<ChevronIcon size={18} color={c.danger} />
				</Pressable>

				<MarketStrip />

				<MarketVideos />

				<RecentlyViewed />

				{parcels.map((order) => (
					<ParcelRow key={order.id} order={order} />
				))}

				{/* No requests yet — no empty heading either. */}
				{items.length ? (
					<>
						<View style={{ height: 2 }} />
						<Caps large link={t('Все')} onLink={() => router.push('/my-requests')}>{t('Мои запросы')}</Caps>
					</>
				) : null}
				<QueryErrorBanner
					error={requests.error}
					onRetry={() => requests.refetch()}
					offlineText={t('Нет сети. Покажем запросы, когда появится')}
				/>
				{!items.length && (requests.isLoading || services.isLoading) ? (
						<>
							<View style={{ height: 2 }} />
							<Skeleton width={130} height={14} />
							<SkeletonRepeat count={PREVIEW} gap={10}>
								<RequestCardSkeleton />
							</SkeletonRepeat>
						</>
					) : null}
					{items.slice(0, PREVIEW).map((item) => (
						<MyRequestItem key={`${item.kind}-${item.request.id}`} row={item} />
					))}
				{requests.isFetchingNextPage || services.isFetchingNextPage ? <RequestCardSkeleton /> : null}


			</ScrollView>

		</View>
	)
}

/** A parcel on the way — «Где посылка». */
function ParcelRow({ order }: { order: DeliveryOrder }) {
	const c = useColors()
	return (
		<RequestCard
			tile={
				<Tile>
					<TruckIcon size={22} color={c.brandStrong} />
				</Tile>
			}
			title={order.part.title}
			status={`${deliveryStatusText(order)} · ${order.number}`}
			live={order.status === 'PICKED_UP'}
			onPress={() => router.push({ pathname: '/delivery-order', params: { id: String(order.id) } })}
		/>
	)
}

function ServiceTile({ label, icon, muted, onPress }: { label: string; icon: ReactNode; muted?: boolean; onPress: () => void }) {
	const c = useColors()
	// Mashina.kg style: grey tile, icon top-left, label bottom-left (up to two lines).
	return (
		<Pressable
			onPress={onPress}
			style={{
				flex: 1,
				height: 96,
				borderRadius: 18,
				backgroundColor: c.card,
				justifyContent: 'space-between',
				padding: 10,
			}}
		>
			<View
				style={{
					width: 40,
					height: 40,
					borderRadius: 12,
					backgroundColor: muted ? c.surface : c.brandTint,
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				{icon}
			</View>
			<Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: fs.sm, lineHeight: 17, fontFamily: fontFamily(500), color: c.ink }}>
				{label}
			</Text>
		</Pressable>
	)
}

/** A card of «Мои запросы»: tile, title, status line, chevron; optional chip row under it. */
function RequestCard({
	tile,
	title,
	status,
	live,
	chip,
	onPress,
}: {
	tile: ReactNode
	title: string
	status: string
	live?: boolean
	chip?: string
	onPress: () => void
}) {
	const c = useColors()
	return (
		<Pressable onPress={onPress} style={{ borderRadius: 18, backgroundColor: c.card, padding: 12, gap: 10 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
				{tile}
				<View style={{ flex: 1, gap: 3 }}>
					<Text numberOfLines={1} style={{ fontSize: fs.lg, fontFamily: fontFamily(700), color: c.ink }}>
						{title}
					</Text>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
						{live ? <LiveDot /> : null}
						<Text numberOfLines={1} style={{ flex: 1, fontSize: fs.md, fontFamily: fontFamily(400), color: c.muted }}>
							{status}
						</Text>
					</View>
				</View>
				<ChevronIcon size={20} color={c.chevron} />
			</View>
			{chip ? (
				<View style={{ flexDirection: 'row' }}>
					<MetaChip label={chip} tone="green" />
				</View>
			) : null}
		</Pressable>
	)
}

function RequestCardSkeleton() {
	const c = useColors()
	return (
		<View style={{ borderRadius: 18, backgroundColor: c.card, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<Skeleton width={52} height={52} radius={14} />
			<View style={{ flex: 1, gap: 9 }}>
				<Skeleton width="70%" height={17} />
				<Skeleton width="45%" height={14} />
			</View>
		</View>
	)
}

/** The tile on the left: the request's photo when there is one (so the rows don't look alike), else the icon. */
function Tile({ children, photo }: { children: ReactNode; photo?: string | null }) {
	const c = useColors()
	if (photo) return <Image source={{ uri: resolveUrl(photo) }} style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: c.brandTint }} />
	return (
		<View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: c.brandTint, alignItems: 'center', justifyContent: 'center' }}>
			{children}
		</View>
	)
}

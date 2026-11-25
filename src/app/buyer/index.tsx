import { useEffect, useRef } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View, type ScrollViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useScrollToTop } from 'expo-router'
import { usePullRefresh } from '@/lib/use-pull-refresh'
import { QueryErrorBanner, Skeleton, SkeletonRepeat } from '@/components/ui'
import { Caps, LoupeIcon } from '@/components/buyer-v23'
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
import { t } from '@/i18n'
import { requireSignIn } from '@/components/sign-in-prompt'
import { Greeting } from '@/components/greeting'
import { GarageNudge } from '@/components/garage-nudge'
import { useRoadsidePack } from '@/store/useRoadsidePack'

/** Rows shown before «Все». */
const PREVIEW = 3

/** 03 Главная по важности: «Найти запчасть», «Мои запросы» (ответы продавцов), потом рынки, видео и недавнее. */
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
	const pull = usePullRefresh(() => [cars.refetch(), requests.refetch(), services.refetch()])
	// Parts requests and service requests in one list, newest first.
	const items = mergeRequests(flattenPages(requests.data), flattenPages(services.data))
	const car = cars.data?.find((item) => item.isPrimary) ?? cars.data?.[0]
	const name = me.data?.name
	// Keep the roadside directory fresh while there is internet — it is what helps on a pass without it.
	const syncRoadside = useRoadsidePack((s) => s.sync)
	useEffect(() => {
		syncRoadside()
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
				{/* Главное действие — «Найти запчасть»; мастер и «сломалась машина» — в «＋». */}
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

				{/* Ниже — то, что смотрят, когда своё уже проверили: рынки, видео, недавнее. */}
				<View style={{ height: 6 }} />
				<MarketStrip />

				<MarketVideos title={t('Видео с рынка')} />

				<RecentlyViewed />


			</ScrollView>

			{/* Гараж пустой — мягко предложить добавить машину. */}
			<GarageNudge />
		</View>
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

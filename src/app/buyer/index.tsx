import { useEffect, useRef } from 'react'
import { RefreshControl, ScrollView, View, type ScrollViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useScrollToTop } from 'expo-router'
import { usePullRefresh } from '@/lib/use-pull-refresh'
import { QueryErrorBanner, Skeleton, SkeletonRepeat } from '@/components/ui'
import { Caps } from '@/components/buyer-v23'
import { MarketVideos } from '@/components/market-videos'
import { MarketStrip } from '@/components/market-strip'
import { RecentlyViewed } from '@/components/recently-viewed'
import { MyRequestItem, mergeRequests } from '@/components/my-requests'
import { useColors } from '@/theme'
import { useMe } from '@/api/me'
import { useCars } from '@/api/garage'
import { useMyRequests } from '@/api/requests'
import { flattenPages } from '@/api/pagination'
import { useMyServiceRequests } from '@/api/services'
import { useSignedIn } from '@/api/catalog'
import { t } from '@/i18n'
import { Greeting } from '@/components/greeting'
import { GarageNudge } from '@/components/garage-nudge'
import { useRoadsidePack } from '@/store/useRoadsidePack'

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
	const pull = usePullRefresh(() => [cars.refetch(), requests.refetch(), services.refetch()])
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
				{/* «Найти запчасть», «Нужен мастер», «Сломалась машина» — в «＋» посередине меню, здесь не дублируем. */}
				<MarketStrip />

				<MarketVideos />

				<RecentlyViewed />

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

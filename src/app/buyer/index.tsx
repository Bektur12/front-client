import { useEffect, useRef } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useScrollToTop } from 'expo-router'
import { usePullRefresh } from '@/lib/use-pull-refresh'
import { Button, EmptyState, QueryErrorBanner, Skeleton, SkeletonProductGrid, SkeletonRepeat } from '@/components/ui'
import { Caps, LoupeIcon } from '@/components/buyer-v23'
import { SearchIcon } from '@/components/icons'
import { MarketVideos } from '@/components/market-videos'
import { MyRequestItem, mergeRequests } from '@/components/my-requests'
import { PartTile } from '@/components/catalog-screen'
import { BrandCarousel, CarSwitch, CategoryCarousel, FeedTitle, HomeSearch, TrendingToday } from '@/components/home-sections'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { useMe } from '@/api/me'
import { useCars } from '@/api/garage'
import { useMyRequests } from '@/api/requests'
import { flattenPages } from '@/api/pagination'
import { useMyServiceRequests } from '@/api/services'
import { useSearchParts, useSignedIn } from '@/api/catalog'
import type { PartCard } from '@/api/types'
import { t } from '@/i18n'
import { requireSignIn } from '@/components/sign-in-prompt'
import { Greeting } from '@/components/greeting'
import { GarageNudge } from '@/components/garage-nudge'
import { useRoadsidePack } from '@/store/useRoadsidePack'

/** Rows shown before «Все». */
const PREVIEW = 2

/**
 * 03 Главная — коротко: поиск, «Найти запчасть» (запрос продавцам), мои запросы, актуальное, категории
 * (марки — только без машины), видео с рынка; внизу — лента в две колонки: с машиной — только подходящие к ней, без машины — новые на витрине.
 */
export default function BuyerHomeScreen() {
	const c = useColors()
	// Tapping the active tab again scrolls back to the top, as in every app.
	const list = useRef<FlatList<PartCard[]>>(null)
	useScrollToTop(list)
	const insets = useSafeAreaInsets()
	const me = useMe()
	const signedIn = useSignedIn()
	const cars = useCars(signedIn)
	const requests = useMyRequests()
	const services = useMyServiceRequests()
	// Parts requests and service requests in one list, newest first.
	const items = mergeRequests(flattenPages(requests.data), flattenPages(services.data))
	const carList = signedIn ? (cars.data ?? []) : []
	const car = carList.find((item) => item.isPrimary) ?? carList[0]
	// Keep the roadside directory fresh while there is internet — it is what helps on a pass without it.
	const syncRoadside = useRoadsidePack((s) => s.sync)
	useEffect(() => {
		syncRoadside()
	}, [signedIn, syncRoadside])

	// The feed: parts for the car (fitting first — the server sorts them so) or simply the newest.
	const feedTab: 'car' | 'new' = car ? 'car' : 'new'
	const feed = useSearchParts(feedTab === 'car' && car ? { carId: car.id, sort: 'NEWEST' } : { sort: 'NEWEST' })
	const all = feed.data?.pages.flatMap((page) => page.items) ?? []
	// «Для Camry 50» — only parts that fit: the server puts them first, the rest («ко всем моделям» and others) is cut off.
	const cut = feedTab === 'car' ? all.findIndex((part) => part.fits === false) : -1
	const parts = cut >= 0 ? all.slice(0, cut) : all
	const feedEnded = cut >= 0 || !feed.hasNextPage
	const rows: PartCard[][] = []
	for (let i = 0; i < parts.length; i += 2) rows.push(parts.slice(i, i + 2))

	const pull = usePullRefresh(() => [cars.refetch(), requests.refetch(), services.refetch(), feed.refetch()])

	const header = (
		<View style={{ gap: 14, paddingBottom: 14 }}>
			<HomeSearch carId={car?.id} />

			{/* Главное действие — запрос всем продавцам; мастер и «сломалась машина» — в «＋». */}
			<Pressable onPress={() => requireSignIn() && router.push({ pathname: '/search-part', params: { carId: car ? String(car.id) : undefined } })}>
				<LinearGradient
					colors={fixed.brandGradient}
					start={{ x: 0.25, y: 0 }}
					end={{ x: 0.75, y: 1 }}
					style={{ minHeight: 84, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' }}
				>
					<View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
						<LoupeIcon size={22} color={fixed.white} strokeWidth={2.6} />
					</View>
					<View style={{ flex: 1, gap: 2 }}>
						<Text style={{ fontSize: fs.xl, lineHeight: 25, fontFamily: fontFamily(800), letterSpacing: -0.3, color: fixed.white }}>{t('Найти запчасть')}</Text>
						<Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: 'rgba(255,255,255,0.88)' }}>{t('Спросите всех продавцов сразу — ответят с ценой')}</Text>
					</View>
				</LinearGradient>
			</Pressable>

			{/* No requests yet — no empty heading either. */}
			{items.length ? <Caps large link={t('Все')} onLink={() => router.push('/my-requests')}>{t('Мои запросы')}</Caps> : null}
			<QueryErrorBanner error={requests.error} onRetry={() => requests.refetch()} offlineText={t('Нет сети. Покажем запросы, когда появится')} />
			{!items.length && (requests.isLoading || services.isLoading) ? (
				<SkeletonRepeat count={PREVIEW} gap={10}>
					<RequestCardSkeleton />
				</SkeletonRepeat>
			) : null}
			{items.slice(0, PREVIEW).map((item) => (
				<MyRequestItem key={`${item.kind}-${item.request.id}`} row={item} />
			))}

			<TrendingToday carId={car?.id} signedIn={signedIn} />
			<CategoryCarousel />
			{/* Марки — только без машины: с машиной всё и так подстроено под неё. Рынки — в «＋», недавнее — в профиле. */}
			{car ? null : <BrandCarousel />}
			<MarketVideos title={t('Видео с рынка')} />

			<View style={{ height: 4 }} />
			<FeedTitle carLabel={car?.title} />
			<QueryErrorBanner error={feed.error} onRetry={() => feed.refetch()} offlineText={t('Нет сети. Покажем запчасти, когда появится')} />
		</View>
	)

	return (
		<View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
			<View style={{ minHeight: 68, paddingHorizontal: 16, paddingVertical: 8, gap: 2 }}>
				{/* «Салам, {имя}!» and the car under it — tap the car to switch. */}
				<Greeting name={me.data?.name} />
				<CarSwitch cars={carList} car={car} />
			</View>

			<FlatList
				ref={list}
				data={rows}
				keyExtractor={(row) => row.map((part) => part.id).join('-')}
				ListHeaderComponent={header}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
				contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 110, gap: 20 }}
				showsVerticalScrollIndicator={false}
				refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={c.muted} />}
				onEndReached={() => !feedEnded && !feed.isFetchingNextPage && feed.fetchNextPage()}
				onEndReachedThreshold={0.6}
				renderItem={({ item: row }) => (
					<View style={{ flexDirection: 'row', gap: 12 }}>
						{row.map((part) => (
							<View key={part.id} style={{ flex: 1 }}>
								<PartTile part={part} />
							</View>
						))}
						{row.length === 1 ? <View style={{ flex: 1 }} /> : null}
					</View>
				)}
				ListFooterComponent={
					feed.isFetchingNextPage ? (
						<SkeletonProductGrid rows={1} />
					) : feedTab === 'car' && feedEnded && parts.length ? (
						// Подходящие кончились — дальше спросить продавцов: у них многое лежит не на витрине.
						<Button variant="secondary" label={t('Не нашли? Спросить продавцов')} onPress={() => requireSignIn() && router.push({ pathname: '/search-part', params: { carId: car ? String(car.id) : undefined } })} />
					) : undefined
				}
				ListEmptyComponent={
					feed.isLoading ? (
						<SkeletonProductGrid rows={2} />
					) : feed.isSuccess ? (
						<EmptyState
							title={feedTab === 'car' && car ? t('К {0} пока нет на витрине', car.title) : t('Пока пусто на витрине')}
							icon={SearchIcon}
							hint={t('Спросите у продавцов рынка — кто-то наверняка держит её не на витрине')}
							action={{ label: t('Спросить у продавцов'), onPress: () => requireSignIn() && router.push({ pathname: '/search-part', params: { carId: car ? String(car.id) : undefined } }) }}
						/>
					) : undefined
				}
			/>

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

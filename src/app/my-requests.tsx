import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EmptyState, QueryErrorBanner, ScreenHeader, SkeletonRepeat } from '@/components/ui'
import { MyRequestItem, RequestCardSkeleton, mergeRequests, requestGroup, type MyRequestGroup } from '@/components/my-requests'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { onNearEnd } from '@/lib/scroll'
import { usePullRefresh } from '@/lib/use-pull-refresh'
import { useMyRequests } from '@/api/requests'
import { useMyServiceRequests } from '@/api/services'
import { flattenPages } from '@/api/pagination'
import { t } from '@/i18n'

const GROUPS: { value: MyRequestGroup; label: string; empty: string }[] = [
	{ value: 'active', label: t('Ищем'), empty: t('Сейчас ничего не ищем') },
	{ value: 'found', label: t('Нашли'), empty: t('Здесь будут запросы, на которые ответили «есть»') },
	{ value: 'notFound', label: t('Не нашли'), empty: t('Здесь будут запросы, на которые никто не ответил') },
]

/** «Мои запросы» целиком: ищем сейчас / нашли / не нашли, со статистикой и «Удалить» в «⋯». */
export default function MyRequestsScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const requests = useMyRequests()
	const services = useMyServiceRequests()
	const pull = usePullRefresh(() => [requests.refetch(), services.refetch()])
	const rows = mergeRequests(flattenPages(requests.data), flattenPages(services.data))
	const counts = { active: 0, found: 0, notFound: 0 }
	for (const row of rows) counts[requestGroup(row)]++
	// Open where something is going on: what we're looking for now, else what was found.
	const [group, setGroup] = useState<MyRequestGroup | null>(null)
	const shown = group ?? (counts.active ? 'active' : counts.found ? 'found' : 'active')
	const visible = rows.filter((row) => requestGroup(row) === shown)
	const loading = !rows.length && (requests.isLoading || services.isLoading)
	const loadMore = () => {
		if (requests.hasNextPage && !requests.isFetchingNextPage) requests.fetchNextPage()
		if (services.hasNextPage && !services.isFetchingNextPage) services.fetchNextPage()
	}

	return (
		<View style={{ flex: 1, backgroundColor: c.surface }}>
			<ScreenHeader inset title={t('Мои запросы')} />
			<View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
				{GROUPS.map((item) => {
					const selected = item.value === shown
					return (
						<Pressable
							key={item.value}
							onPress={() => setGroup(item.value)}
							style={{
								flex: 1,
								height: 44,
								borderRadius: 12,
								backgroundColor: selected ? c.brand : c.card,
								flexDirection: 'row',
								alignItems: 'center',
								justifyContent: 'center',
								gap: 6,
							}}
						>
							<Text numberOfLines={1} style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: selected ? fixed.white : c.ink }}>
								{item.label}
							</Text>
							{counts[item.value] ? (
								<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: selected ? fixed.white : c.muted }}>{counts[item.value]}</Text>
							) : null}
						</Pressable>
					)
				})}
			</View>
			<ScrollView
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 10 }}
				onScroll={onNearEnd(loadMore)}
				scrollEventThrottle={200}
				refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={c.muted} />}
			>
				<QueryErrorBanner error={requests.error ?? services.error} onRetry={() => (requests.refetch(), services.refetch())} />
				{loading ? (
					<SkeletonRepeat count={4} gap={10}>
						<RequestCardSkeleton />
					</SkeletonRepeat>
				) : null}
				{visible.map((row) => (
					<MyRequestItem key={`${row.kind}-${row.request.id}`} row={row} />
				))}
				{!loading && !visible.length ? <EmptyState title={GROUPS.find((item) => item.value === shown)?.empty ?? ''} /> : null}
				{requests.isFetchingNextPage || services.isFetchingNextPage ? <RequestCardSkeleton /> : null}
			</ScrollView>
		</View>
	)
}

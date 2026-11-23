import { useCallback, useState, type ReactNode } from 'react'
import { FlatList, Text, View, type ListViewToken } from 'react-native'
import { router, useIsFocused } from 'expo-router'
import { VideoTile } from '@/components/video-v23'
import { Skeleton } from '@/components/ui'
import { fontFamily, fs, useColors } from '@/theme'
import { flattenPages } from '@/api/pagination'
import { useVideoFeed } from '@/api/catalog'
import { useVideoViewer } from '@/store/useVideoViewer'
import { marketPlace } from '@/lib/shop-place'
import { t } from '@/i18n'

/**
 * Videos from the market — ads, the same for everyone (not tied to a car): tiles play by themselves without sound,
 * a tap opens the feed on that video. `title` — the heading on the left of «Смотреть все»; `leading` — a tile before
 * the videos (the seller's «＋ Снять», like «Ваша история» in Instagram), shown even when there are no videos yet.
 */
export function MarketVideos({ title, leading }: { title?: string; leading?: ReactNode } = {}) {
	const c = useColors()
	const feed = useVideoFeed()
	const items = flattenPages(feed.data)
	const focused = useIsFocused()
	const [visible, setVisible] = useState<number[]>([0, 1, 2])
	// FlatList wants the same callback for its whole life.
	const onViewable = useCallback(
		({ viewableItems }: { viewableItems: ListViewToken[] }) =>
			setVisible(viewableItems.flatMap((token) => (token.index == null ? [] : [token.index]))),
		[]
	)

	if (feed.isLoading)
		return (
			<View style={{ gap: 10, paddingTop: 2 }}>
				<View style={{ alignItems: 'flex-end' }}>
					<Skeleton width={110} height={18} />
				</View>
				<View style={{ flexDirection: 'row', gap: 8, marginHorizontal: -16, paddingLeft: 16, overflow: 'hidden' }}>
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} width={172} height={250} radius={18} />
					))}
				</View>
			</View>
		)
	if (!items.length && !leading) return null

	const openFeed = (partId?: number) => {
		if (partId) useVideoViewer.getState().openVideo(partId)
		router.push('/videos')
	}

	return (
		<View style={{ gap: 10, paddingTop: 2 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
				{title ? (
					<Text style={{ flex: 1, fontSize: fs.lg, fontFamily: fontFamily(700), color: c.ink }}>{title}</Text>
				) : (
					<View style={{ flex: 1 }} />
				)}
				{items.length ? <Text onPress={() => openFeed()} style={{ flexShrink: 0, fontSize: fs.base, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('Смотреть все')}</Text> : null}
			</View>
			<FlatList
				horizontal
				data={items}
				keyExtractor={(item) => String(item.partId)}
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{ gap: 8 }}
				style={{ marginHorizontal: -16 }}
				ListHeaderComponent={
					<View style={{ flexDirection: 'row' }}>
						<View style={{ width: 8 }} />
						{leading ? <View style={{ marginRight: 8 }}>{leading}</View> : null}
					</View>
				}
				ListFooterComponent={<View style={{ width: 8 }} />}
				onViewableItemsChanged={onViewable}
				viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
				renderItem={({ item, index }) => (
					<VideoTile
						video={item.video}
						title={item.title}
						price={item.price}
						place={marketPlace(item.shop.place)}
						playing={focused && visible.includes(index)}
						onPress={() => openFeed(item.partId)}
					/>
				)}
			/>
		</View>
	)
}

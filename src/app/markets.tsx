import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useMarkets } from '@/api/market'
import { useShopList } from '@/api/catalog'
import { flattenPages } from '@/api/pagination'
import type { Market } from '@/api/types'
import { QueryErrorBanner, ScreenHeader, Skeleton } from '@/components/ui'
import { MarketLetter } from '@/components/market-chips'
import { sellersLabel } from '@/components/market-switch'
import { marketHours, marketLook } from '@/lib/markets'
import { open2gis } from '@/lib/shop-place'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

/** «Рынки»: все рынки карточками — часы, продавцы в приложении, схема или список продавцов, «Маршрут». */
export default function MarketsScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const markets = useMarkets()

	return (
		<View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
			<ScreenHeader title={t('Рынки')} />
			<ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, paddingBottom: insets.bottom + 24 }}>
				<Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: c.muted }}>
					{t('Вт–вс 9:00–17:00, в понедельник рынки не работают')}
				</Text>
				<QueryErrorBanner error={markets.error} onRetry={() => markets.refetch()} />
				{markets.isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} height={150} radius={20} />) : null}
				{(markets.data ?? []).map((market) => (
					<MarketCard key={market.id} market={market} />
				))}
			</ScrollView>
		</View>
	)
}

function MarketCard({ market }: { market: Market }) {
	const c = useColors()
	const look = marketLook(market.code)
	const hours = marketHours()
	const shops = useShopList('', market.id)
	const count = flattenPages(shops.data).length
	const open = () => router.navigate({ pathname: '/buyer/market', params: { market: String(market.id) } })

	return (
		<Pressable onPress={open} style={{ borderRadius: 20, backgroundColor: c.card, padding: 14, gap: 12 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
				<MarketLetter code={market.code} />
				<View style={{ flex: 1, gap: 2 }}>
					<Text style={{ fontSize: fs.lg, fontFamily: fontFamily(800), color: c.ink }}>{market.name}</Text>
					<Text style={{ fontSize: fs.sm, lineHeight: 18, fontFamily: fontFamily(500), color: c.muted }}>
						{[look.address, look.near].filter(Boolean).join(' · ')}
					</Text>
				</View>
			</View>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
				<Pill text={`● ${hours.label}`} color={hours.open ? c.success : c.muted} />
				{shops.isSuccess ? <Pill text={sellersLabel(count, Boolean(shops.hasNextPage))} color={c.inkSecondary} /> : null}
				{market.hasScheme || market.hasMap ? <Pill text={t('Схема рядов')} color={c.brandStrong} background={c.brandTint} /> : null}
			</View>
			<View style={{ flexDirection: 'row', gap: 8 }}>
				<Pressable onPress={open} style={{ flex: 1, height: 42, borderRadius: 12, backgroundColor: look.color, alignItems: 'center', justifyContent: 'center' }}>
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: fixed.white }}>{market.hasScheme || market.hasMap ? t('Открыть схему') : t('Продавцы')}</Text>
				</Pressable>
				<Pressable
					onPress={() => open2gis({ lng: look.point[0], lat: look.point[1] })}
					style={{ flex: 1, height: 42, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}
				>
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.ink }}>{t('Маршрут')}</Text>
				</Pressable>
			</View>
		</Pressable>
	)
}

function Pill({ text, color, background }: { text: string; color: string; background?: string }) {
	const c = useColors()
	return (
		<View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: background ?? c.surface }}>
			<Text style={{ fontSize: fs.xs, fontFamily: fontFamily(700), color }}>{text}</Text>
		</View>
	)
}

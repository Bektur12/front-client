import { FlatList, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useMarkets } from '@/api/market'
import { useShopList } from '@/api/catalog'
import { flattenPages } from '@/api/pagination'
import type { Market } from '@/api/types'
import { Button, QueryErrorBanner } from '@/components/ui'
import { MapPinIcon, SearchIcon } from '@/components/icons'
import { MarketLetter } from '@/components/market-chips'
import { ShopRow, ShopRowSkeleton } from '@/app/shops'
import { marketHours, marketLook } from '@/lib/markets'
import { open2gis } from '@/lib/shop-place'
import { plural } from '@/lib/format'
import { useCatalogFilters } from '@/store/useCatalogFilters'
import { requireSignIn } from '@/components/sign-in-prompt'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

/** «Кудайберген · Геология · Дордой Моторс · Дордой · Все ›» — over the map (floating) or above a market's page. */
export function MarketSwitch({ value, onChange, floating = false }: { value: number; onChange: (marketId: number) => void; floating?: boolean }) {
	const c = useColors()
	const markets = useMarkets().data ?? []
	if (markets.length < 2) return null
	const shadow = floating
		? { shadowColor: fixed.shadow, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 3 }
		: {}
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: floating ? 2 : 0 }}>
			{markets.map((market) => {
				const on = market.id === value
				const look = marketLook(market.code)
				return (
					<Pressable
						key={market.id}
						onPress={() => onChange(market.id)}
						style={{
							height: 40,
							paddingLeft: 9,
							paddingRight: 14,
							borderRadius: 20,
							flexDirection: 'row',
							alignItems: 'center',
							gap: 7,
							backgroundColor: on ? look.tint : c.card,
							borderWidth: 1.5,
							borderColor: on ? look.color : floating ? c.card : c.border,
							...shadow,
						}}
					>
						<MarketLetter code={market.code} size="sm" />
						<Text style={{ fontSize: fs.md, fontFamily: fontFamily(on ? 800 : 600), color: on ? look.ink : c.ink }}>{market.name}</Text>
					</Pressable>
				)
			})}
			<Pressable
				onPress={() => router.push('/markets')}
				style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: c.card, borderWidth: 1.5, borderColor: floating ? c.card : c.border, ...shadow }}
			>
				<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('Все ›')}</Text>
			</Pressable>
		</ScrollView>
	)
}

/** «Открыто» on a light tint — dark green, readable in both themes. */
const OPEN_ON_LIGHT = '#08703E'

/**
 * «Открыто до 17:00 · пн выходной» in green / grey. `onLight` — on the market's light tint: the tint is the same in the
 * dark theme, so the text stays dark there too (theme colors were white on the near-white tint).
 */
export function MarketHoursLine({ prefix, onLight }: { prefix?: string; onLight?: boolean }) {
	const c = useColors()
	const hours = marketHours()
	const muted = onLight ? fixed.mutedOnLight : c.muted
	const open = onLight ? OPEN_ON_LIGHT : c.success
	return (
		<Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: muted }}>
			{prefix ? `${prefix} · ` : ''}
			<Text style={{ fontFamily: fontFamily(700), color: hours.open ? open : muted }}>{hours.label}</Text>
			{hours.open ? t(' · пн выходной') : ''}
		</Text>
	)
}

/**
 * A market without a row scheme (Геология, Дордой Моторс, Дордой): its header in the market's color, «Маршрут» to 2GIS,
 * «Найти здесь» — the catalog filtered by it, and the market's sellers (or an empty state that leads to a request).
 */
export function MarketPage({ market, switcher }: { market: Market; switcher: React.ReactNode }) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const look = marketLook(market.code)
	const shops = useShopList('', market.id)
	const items = flattenPages(shops.data)
	const count = items.length
	const more = Boolean(shops.hasNextPage)

	const findHere = () => {
		useCatalogFilters.getState().setMarket(market.id)
		router.navigate('/buyer/parts')
	}

	const header = (
		<View style={{ gap: 12 }}>
			{switcher}
			<View style={{ marginHorizontal: 16, marginTop: 4, borderRadius: 22, padding: 16, backgroundColor: look.tint, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
				<MarketLetter code={market.code} size="lg" />
				<View style={{ flex: 1, gap: 3 }}>
					{/* The tint is light in both themes — dark text on it, not the theme's (white in the dark theme). */}
					<Text style={{ fontSize: fs.xl, fontFamily: fontFamily(800), color: look.ink }}>{market.name}</Text>
					<Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: fixed.mutedOnLight }}>
						{[look.address, look.near].filter(Boolean).join(' · ')}
					</Text>
					<MarketHoursLine onLight />
				</View>
			</View>
			<View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
				<Button
					label={t('Маршрут')}
					height={52}
					icon={MapPinIcon}
					onPress={() => open2gis({ lng: look.point[0], lat: look.point[1] })}
					style={{ flex: 1 }}
				/>
				{count ? <Button label={t('Найти здесь')} variant="secondary" height={52} icon={SearchIcon} onPress={findHere} style={{ flex: 1 }} /> : null}
			</View>
			<QueryErrorBanner error={shops.error} onRetry={() => shops.refetch()} />
			{count ? (
				<Text style={{ marginHorizontal: 16, marginTop: 8, fontSize: fs.sm, fontFamily: fontFamily(700), letterSpacing: 0.5, color: c.muted }}>
					{t('ПРОДАВЦЫ В ПРИЛОЖЕНИИ · {0}', more ? `${count}+` : count)}
				</Text>
			) : null}
		</View>
	)

	return (
		<View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top + 8 }}>
			<FlatList
				data={items}
				keyExtractor={(shop) => String(shop.id)}
				ListHeaderComponent={header}
				contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
				renderItem={({ item }) => (
					<View style={{ paddingHorizontal: 16 }}>
						<ShopRow shop={item} />
					</View>
				)}
				onEndReached={() => shops.hasNextPage && !shops.isFetchingNextPage && shops.fetchNextPage()}
				ListEmptyComponent={
					shops.isLoading ? (
						<View style={{ paddingHorizontal: 16, gap: 8, marginTop: 8 }}>
							<ShopRowSkeleton />
							<ShopRowSkeleton />
						</View>
					) : shops.isSuccess ? (
						<View style={{ margin: 16, marginTop: 14, padding: 22, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: c.border, alignItems: 'center', gap: 8 }}>
							<Text style={{ fontSize: fs.lg, lineHeight: 23, fontFamily: fontFamily(700), color: c.ink, textAlign: 'center' }}>
								{t('Продавцов рынка {0} пока нет в приложении', market.name)}
							</Text>
							<Text style={{ fontSize: fs.md, lineHeight: 21, fontFamily: fontFamily(400), color: c.muted, textAlign: 'center' }}>
								{t('Ищите запчасть через запрос: её увидят продавцы всех рынков.')}
							</Text>
							<Button label={t('Найти запчасть')} height={48} onPress={() => requireSignIn() && router.push('/search-part')} style={{ alignSelf: 'stretch', marginTop: 6 }} />
						</View>
					) : undefined
				}
			/>
		</View>
	)
}

/** «42 продавца» / «50+ продавцов» / «пока нет продавцов». */
export function sellersLabel(count: number, more: boolean) {
	if (!count) return t('пока нет продавцов')
	return `${more ? `${count}+` : count} ${plural(more ? 5 : count, [t('продавец'), t('продавца'), t('продавцов')])}`
}

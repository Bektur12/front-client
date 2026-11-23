import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useQueries } from '@tanstack/react-query'
import { useMarkets } from '@/api/market'
import { apiFetch } from '@/lib/api'
import type { ShopCardPage } from '@/api/types'
import { Caps } from '@/components/buyer-v23'
import { MarketLetter } from '@/components/market-chips'
import { sellersLabel } from '@/components/market-switch'
import { marketLook } from '@/lib/markets'
import { fixed, fontFamily, fs } from '@/theme'
import { t } from '@/i18n'

/**
 * «Рынки · Все ›» on the home screen — small tiles, not a big block: «Найти запчасть» stays the main thing there.
 * Only markets that have sellers in the app; with fewer than two such markets the strip is hidden — one tile
 * (or tiles leading to empty pages) helps no one. It appears by itself as sellers join other markets.
 */
export function MarketStrip() {
	const markets = useMarkets().data ?? []
	const counts = useQueries({
		queries: markets.map((market) => ({
			queryKey: ['market', 'sellers', market.id],
			queryFn: ({ signal }: { signal: AbortSignal }) => apiFetch<ShopCardPage>('/shops', { query: { marketId: market.id }, auth: false, signal }),
			staleTime: 10 * 60_000,
		})),
	})
	const withSellers = markets
		.map((market, i) => ({ market, count: counts[i]?.data?.items.length ?? 0, more: Boolean(counts[i]?.data?.nextCursor) }))
		.filter((m) => m.count > 0)
	if (withSellers.length < 2) return null

	return (
		<View style={{ gap: 10 }}>
			<Caps large link={t('Все')} onLink={() => router.push('/markets')}>
				{t('Рынки')}
			</Caps>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
				{withSellers.map(({ market, count, more }) => {
					const look = marketLook(market.code)
					return (
						<Pressable
							key={market.id}
							onPress={() => router.navigate({ pathname: '/buyer/market', params: { market: String(market.id) } })}
							style={{ width: 124, borderRadius: 16, padding: 10, backgroundColor: look.tint, gap: 8 }}
						>
							<MarketLetter code={market.code} />
							<View style={{ gap: 2 }}>
								{/* light tint in both themes — dark text on it */}
								<Text numberOfLines={1} style={{ fontSize: fs.md, fontFamily: fontFamily(800), color: look.ink }}>{market.name}</Text>
								<Text numberOfLines={1} style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: fixed.mutedOnLight }}>{sellersLabel(count, more)}</Text>
							</View>
						</Pressable>
					)
				})}
			</ScrollView>
		</View>
	)
}

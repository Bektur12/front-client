import { Pressable, ScrollView, Text, View } from 'react-native'
import { useMarkets } from '@/api/market'
import { marketLook } from '@/lib/markets'
import { open2gis } from '@/lib/shop-place'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

/** marketId of «Магазины и центры» — shops off the markets (the backend's PartSearch.NO_MARKET). */
export const OFF_MARKET = 0

const LETTER = { sm: { box: 22, radius: 7, font: 10 }, md: { box: 40, radius: 12, font: 15 }, lg: { box: 52, radius: 15, font: 19 } }

/** The market's letter on its color: «К» Кудайберген, «Г» Геология, «ДМ» Дордой Моторс, «Д» Дордой. */
export function MarketLetter({ code, size = 'md', inverted = false }: { code: string; size?: keyof typeof LETTER; inverted?: boolean }) {
	const look = marketLook(code)
	const s = LETTER[size]
	return (
		<View
			style={{
				width: s.box,
				height: s.box,
				borderRadius: s.radius,
				backgroundColor: inverted ? fixed.white : look.color,
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<Text style={{ fontSize: s.font, fontFamily: fontFamily(800), letterSpacing: -0.3, color: inverted ? look.color : fixed.white }}>{look.letter}</Text>
		</View>
	)
}

/** «Только рынок Геология · ул. Профсоюзная · Маршрут ›» under the chips — why there are fewer parts now. */
export function MarketFilterBanner({ marketId }: { marketId: number | null }) {
	const market = (useMarkets().data ?? []).find((m) => m.id === marketId)
	if (!market) return null
	const look = marketLook(market.code)
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: look.tint }}>
			<MarketLetter code={market.code} size="sm" />
			<Text numberOfLines={2} style={{ flex: 1, fontSize: fs.sm, lineHeight: 18, fontFamily: fontFamily(500), color: look.ink }}>
				{t('Только рынок ')}
				<Text style={{ fontFamily: fontFamily(700) }}>{market.name}</Text>
				{look.address ? ` · ${look.address}` : ''}
			</Text>
			<Text onPress={() => open2gis({ lng: look.point[0], lat: look.point[1] })} style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: look.ink }}>
				{t('Маршрут ›')}
			</Text>
		</View>
	)
}

/**
 * «Все рынки · Кудайберген · Геология · Дордой Моторс · Дордой · Магазины и центры» — the buyer picks where to look.
 * Each market has its letter; the picked one is filled with its color. null — everywhere.
 */
export function MarketChips({ value, onChange }: { value: number | null; onChange: (marketId: number | null) => void }) {
	const c = useColors()
	const markets = useMarkets().data ?? []
	// Until the list loads (or offline with nothing cached) there is nothing to choose from.
	if (!markets.length) return null
	const options = [
		{ id: null as number | null, name: t('Все рынки'), code: null as string | null },
		...markets.map((market) => ({ id: market.id as number | null, name: market.name, code: market.code as string | null })),
		{ id: OFF_MARKET as number | null, name: t('Магазины и центры'), code: null as string | null },
	]
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
			{options.map((option) => {
				const active = value === option.id
				const look = option.code ? marketLook(option.code) : null
				const fill = active ? (look?.color ?? c.ink) : 'transparent'
				return (
					<Pressable
						key={option.id ?? 'all'}
						onPress={() => onChange(option.id)}
						style={{
							height: 34,
							paddingLeft: look ? 6 : 12,
							paddingRight: 12,
							borderRadius: 17,
							backgroundColor: fill,
							borderWidth: 1,
							borderColor: active ? fill : c.border,
							flexDirection: 'row',
							alignItems: 'center',
							gap: 6,
						}}
					>
						{option.code ? <MarketLetter code={option.code} size="sm" inverted={active} /> : null}
						<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(active ? 700 : 600), color: active ? (look ? fixed.white : c.surface) : c.ink }}>{option.name}</Text>
					</Pressable>
				)
			})}
		</ScrollView>
	)
}

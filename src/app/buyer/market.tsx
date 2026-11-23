import { router, useLocalSearchParams } from 'expo-router'
import { MarketMap } from '@/app/market-map'
import { useMarkets } from '@/api/market'
import { MarketPage, MarketSwitch } from '@/components/market-switch'
import { MarketPlanView } from '@/components/market-plan'

/**
 * Вкладка «Рынок». Сверху переключатель рынков: у Кудайбергена — карта с поиском контейнеров и фильтром по марке,
 * у Геологии и других рынков с картой — карта рядов и корпусов, у рынков без карты — их страница с продавцами. `?market=<id>` открывает нужный рынок (плитки, экран «Рынки»).
 */
export default function MarketTab() {
	const params = useLocalSearchParams<{ market?: string }>()
	const markets = useMarkets().data ?? []
	const picked = markets.find((m) => m.id === Number(params.market)) ?? markets.find((m) => m.hasScheme) ?? markets[0]
	const pick = (marketId: number) => router.setParams({ market: String(marketId) })

	// Пока список рынков не пришёл — карта, как раньше.
	if (!picked || picked.hasScheme) {
		return <MarketMap embedded header={picked ? <MarketSwitch value={picked.id} onChange={pick} floating /> : undefined} />
	}
	if (picked.hasMap || picked.code === 'GEOLOGIYA' /* DEV-HACK */) return <MarketPlanView market={picked} switcher={<MarketSwitch value={picked.id} onChange={pick} floating />} />
	return <MarketPage market={picked} switcher={<MarketSwitch value={picked.id} onChange={pick} />} />
}

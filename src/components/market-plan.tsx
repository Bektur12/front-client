import { useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useMarketPlan, usePlanGeo } from '@/api/market'
import { useShopList } from '@/api/catalog'
import { flattenPages } from '@/api/pagination'
import type { Market } from '@/api/types'
import { MarketMapLive, type MarketMapLiveHandle } from '@/components/market-map-live'
import { Floating, RoundButton } from '@/app/market-map'
import { Button } from '@/components/ui'
import { CloseIcon, LocateIcon, MapPinIcon, StoreIcon } from '@/components/icons'
import { MarketLetter } from '@/components/market-chips'
import { MarketHoursLine, MarketPage, sellersLabel } from '@/components/market-switch'
import { marketLook } from '@/lib/markets'
import { PLACE_KINDS, type SchemePlace } from '@/lib/market-geojson'
import { plural } from '@/lib/format'
import { open2gis } from '@/lib/shop-place'
import { useCatalogFilters } from '@/store/useCatalogFilters'
import { fontFamily, fs, LightTheme, raw, useColors } from '@/theme'
import { t } from '@/i18n'

/**
 * Карта рынка без контейнеров (Геология…): ряды, корпуса, проходы и входы со спутника, «я здесь» по GPS.
 * Внизу — карточка рынка: часы, «Маршрут» в 2GIS и продавцы. Точки — магазины и сервисы из справочника 2ГИС:
 * тап — карточка магазина с адресом, часами и маршрутом. Контейнеров, поиска по рынку и маршрута внутри нет.
 * Карта не загрузилась — страница рынка со списком продавцов, как у рынков без карты.
 */
export function MarketPlanView(props: { market: Market; switcher: React.ReactNode }) {
	// карта всегда светлая (как подложка) — и всё поверх неё тоже, даже в тёмной теме телефона
	return (
		<LightTheme>
			<MarketPlanContent {...props} />
		</LightTheme>
	)
}

function MarketPlanContent({ market, switcher }: { market: Market; switcher: React.ReactNode }) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const look = marketLook(market.code)
	const plan = useMarketPlan(market.id)
	const geo = usePlanGeo(plan.data)
	const mapRef = useRef<MarketMapLiveHandle>(null)
	const shops = useShopList('', market.id)
	const count = flattenPages(shops.data).length
	const [placeIndex, setPlaceIndex] = useState<number | null>(null)
	const place = placeIndex == null ? undefined : plan.data?.pois?.[placeIndex]
	const partsOnMap = useMemo(() => (plan.data?.pois ?? []).filter((poi) => poi.kind === 'PARTS_NEW' || poi.kind === 'PARTS_USED').length, [plan.data])
	const placesOnMap = useMemo(() => (plan.data?.pois ?? []).filter((poi) => PLACE_KINDS.includes(poi.kind)).length, [plan.data])

	if (plan.isError) return <MarketPage market={market} switcher={switcher} />

	const findHere = () => {
		useCatalogFilters.getState().setMarket(market.id)
		router.navigate('/buyer/parts')
	}

	return (
		<View style={{ flex: 1, backgroundColor: raw.mapSurface }}>
			{/* key — новый рынок: камера заново пролетает к нему */}
			{geo ? <MarketMapLive key={market.id} ref={mapRef} geo={geo} showUser onPlacePress={setPlaceIndex} /> : null}
			{!geo ? (
				<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
					<ActivityIndicator color={look.color} />
				</View>
			) : null}

			<View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0 }}>{switcher}</View>

			<View style={{ position: 'absolute', left: 12, right: 12, bottom: 16, gap: 10 }}>
				<View style={{ alignSelf: 'flex-end' }}>
					<RoundButton label={t('Где я')} onPress={() => mapRef.current?.focusOnMe(18)}>
						<LocateIcon size={22} color={c.ink} />
					</RoundButton>
				</View>
				{place ? <PlaceCard place={place} onClose={() => setPlaceIndex(null)} /> : null}
				<Floating style={{ borderRadius: 22, padding: 14, gap: 12, display: place ? 'none' : 'flex' }}>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
						<MarketLetter code={market.code} />
						<View style={{ flex: 1, gap: 2 }}>
							<Text style={{ fontSize: fs.lg, fontFamily: fontFamily(800), color: c.ink }}>{market.name}</Text>
							<MarketHoursLine prefix={shops.isSuccess ? sellersLabel(count, Boolean(shops.hasNextPage)) : undefined} />
						</View>
					</View>
					{placesOnMap ? (
						<Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: c.muted }}>
							{t('На карте {0} {1} запчастей и {2} сервисов — нажмите на точку', partsOnMap, plural(partsOnMap, [t('магазин'), t('магазина'), t('магазинов')]), placesOnMap - partsOnMap)}
						</Text>
					) : null}
					<View style={{ flexDirection: 'row', gap: 10 }}>
						<Button label={t('Маршрут')} height={48} icon={MapPinIcon} onPress={() => open2gis({ lng: look.point[0], lat: look.point[1] })} style={{ flex: 1 }} />
						{count ? <Button label={t('Найти здесь')} variant="secondary" height={48} icon={StoreIcon} onPress={findHere} style={{ flex: 1 }} /> : null}
					</View>
				</Floating>
			</View>
		</View>
	)
}

const KIND_LABEL: Record<string, string> = {
	PARTS_NEW: 'Запчасти',
	PARTS_USED: 'Разбор, контрактные запчасти',
	SERVICE: 'Автосервис',
	GLASS: 'Автостёкла',
	OTHER: 'Автотовары',
}

/** Магазин со справочника: что продаёт, адрес и место, часы; «Маршрут» к нему и карточка в 2ГИС (там телефоны и отзывы). */
function PlaceCard({ place, onClose }: { place: SchemePlace; onClose: () => void }) {
	const c = useColors()
	const where = [place.address, place.place].filter(Boolean).join(' · ')
	return (
		<Floating style={{ borderRadius: 22, padding: 14, gap: 10 }}>
			<View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
				<View style={{ flex: 1, gap: 3 }}>
					<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(700), letterSpacing: 0.3, color: c.brandStrong }}>{t(KIND_LABEL[place.kind] ?? 'Автотовары').toUpperCase()}</Text>
					<Text style={{ fontSize: fs.lg, lineHeight: 23, fontFamily: fontFamily(800), color: c.ink }}>{place.label}</Text>
					{place.what ? <Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: c.inkSecondary }}>{place.what}</Text> : null}
					{where ? <Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: c.muted }}>{where}</Text> : null}
					{place.hours ? <Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: c.muted }}>{place.hours}</Text> : null}
				</View>
				<Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('Закрыть')} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
					<CloseIcon size={18} color={c.ink} />
				</Pressable>
			</View>
			<View style={{ flexDirection: 'row', gap: 10 }}>
				{place.lat != null && place.lon != null ? (
					<Button label={t('Маршрут')} height={48} icon={MapPinIcon} onPress={() => open2gis({ lng: place.lon!, lat: place.lat! })} style={{ flex: 1 }} />
				) : null}
				{place.gisUrl ? <Button label={t('Открыть в 2ГИС')} variant="secondary" height={48} onPress={() => Linking.openURL(place.gisUrl!)} style={{ flex: 1 }} /> : null}
			</View>
		</Floating>
	)
}

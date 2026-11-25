import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { MarketMapLive, type MarketMapLiveHandle } from '@/components/market-map-live'
import { PlacePlate } from '@/components/ui'
import { BrandLogo } from '@/components/ui/brand'
import { BackIcon, BigButton, CrossIcon, LoupeIcon, RouteIcon } from '@/components/buyer-v23'
import { LocateIcon, StoreIcon } from '@/components/icons'
import { schemaToGeo } from '@/lib/geo'
import { findContainer, searchMarket, type MarketHit } from '@/lib/market-search'
import { useMapHighlight, useMarketScheme } from '@/api/market'
import { useBrands, useCategories } from '@/api/directory'
import { CategoryChips } from '@/components/category-chips'
import { fixed, fontFamily, fs, LightTheme, raw, useColors } from '@/theme'
import { t } from '@/i18n'
import { goBack } from '@/lib/navigation'
import { mapPalette } from '@/lib/map-palette'

/** Отдельный экран (из профиля, поиска) — с кнопкой «Назад». Вкладка «Рынок» — app/buyer/market.tsx. */
export default function MarketMapScreen() {
	return <MarketMap />
}

/**
 * Карта рынка: каждый контейнер на своём месте. Поиск «14 12», «ряд Ю», «Жайма 2 7», магазин по названию
 * или марка — она подсвечивает все контейнеры, где её продают, и ведёт к ближайшему. Тап по контейнеру —
 * карточка с продавцом и «Маршрутом». Карта всегда светлая — и экран вокруг неё тоже, даже в тёмной теме.
 */
export function MarketMap({ embedded = false, header }: { embedded?: boolean; header?: ReactNode }) {
	return (
		<LightTheme>
			<StatusBar style="dark" />
			<MarketMapContent embedded={embedded} header={header} />
		</LightTheme>
	)
}

/** header — под поиском, над марками: на вкладке «Рынок» это переключатель рынков. */
function MarketMapContent({ embedded, header }: { embedded: boolean; header?: ReactNode }) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const params = useLocalSearchParams<{ containerId?: string; brandId?: string }>()
	const scheme = useMarketScheme().data
	const mapRef = useRef<MarketMapLiveHandle>(null)
	const [query, setQuery] = useState('')
	const [focused, setFocused] = useState(false)
	const [selectedId, setSelectedId] = useState<number | null>(Number(params.containerId) || null)
	const [brandId, setBrandId] = useState<number | undefined>(Number(params.brandId) || undefined)
	// после марки — что именно: ходовая, оптика… (одна категория, повторный тап снимает)
	const [categoryId, setCategoryId] = useState<number | undefined>()
	const categories = useCategories().data ?? []
	const [sheetHeight, setSheetHeight] = useState(0)

	const popular = useBrands({ popular: true }).data ?? []
	const brandHits = useBrands(query.trim().length >= 2 ? { q: query.trim() } : {}).data ?? []
	const highlight = useMapHighlight('BRAND', brandId, categoryId).data
	const hits = useMemo(() => searchMarket(scheme, query, 6), [scheme, query])
	const selected = selectedId ? findContainer(scheme, selectedId) : null
	const brand = brandId ? [...popular, ...brandHits].find((b) => b.id === brandId) : undefined
	const stats = useMemo(() => {
		const cells = scheme.rows.flatMap((row) => row.containers ?? [])
		return { rows: scheme.rows.length, containers: cells.length, shops: cells.filter((cell) => cell.shop?.shopId).length }
	}, [scheme])

	const topInset = insets.top + 10
	const bottomPad = embedded ? 16 : Math.max(insets.bottom, 20)

	/** Весь рынок — между поиском и шторкой. */
	const showMarket = () => {
		if (!scheme.boundary.length || !sheetHeight) return
		mapRef.current?.fitTo(
			scheme.boundary.map(([x, y]) => schemaToGeo(x, y)),
			{ top: topInset + (header ? 160 : 110), bottom: sheetHeight + 12, left: 16, right: 16 },
		)
	}
	const select = (containerId: number) => {
		setSelectedId(containerId)
		setFocused(false)
		const found = findContainer(scheme, containerId)
		if (found) mapRef.current?.focusOn(schemaToGeo(found.container.x, found.container.y), 19)
	}
	const pickHit = (hit: MarketHit) => {
		if (hit.kind === 'container') {
			setQuery(t('Ряд {0} · конт. {1}', hit.rowCode, hit.container.number))
			select(hit.container.id)
		} else {
			setQuery(hit.rowLabel)
			setFocused(false)
			setSelectedId(null)
			mapRef.current?.focusOnRow(hit.rowId, 18.2)
		}
	}
	const pickBrand = (id: number | undefined) => {
		setBrandId(id)
		setCategoryId(undefined)
		setSelectedId(null)
		setFocused(false)
		if (id) setQuery('')
		showMarket()
	}
	const clear = () => {
		setQuery('')
		setSelectedId(null)
	}

	// первый показ: весь рынок (или сразу выбранный контейнер); дальше камерой управляет человек.
	// Контейнер из ссылки ищем в схеме с сервера — во встроенной копии контейнеров нет, ждём её.
	const framed = useRef(false)
	const hasCells = scheme.rows.some((row) => row.containers?.length)
	useEffect(() => {
		if (framed.current || !sheetHeight) return
		if (selectedId && !hasCells) return
		// отметка — когда камера реально поехала: шторка за эти 400 мс меняет высоту, и таймер перезапускается
		const timer = setTimeout(() => {
			framed.current = true
			if (selectedId) select(selectedId)
			else showMarket()
		}, 400)
		return () => clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps -- только первый кадр
	}, [sheetHeight, hasCells])

	const showResults = focused && query.trim().length > 0
	const matchedBrands = query.trim().length >= 2 ? brandHits.slice(0, 3) : []

	return (
		<View style={{ flex: 1, backgroundColor: raw.mapSurface }}>
			<MarketMapLive
				ref={mapRef}
				targetContainerId={selectedId ?? undefined}
				highlightedRowIds={highlight?.rowIds}
				highlightedContainerIds={highlight?.containerIds}
				onContainerPress={(containerId) => select(containerId)}
			/>

			{/* сверху: поиск и марки */}
			<View style={{ position: 'absolute', left: 0, right: 0, top: topInset, gap: 10 }}>
				<View style={{ paddingHorizontal: 12 }}>
					<Floating style={{ flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 26, paddingHorizontal: 6 }}>
						{embedded ? (
							<View style={{ width: 40, alignItems: 'center' }}>
								<LoupeIcon size={20} color={c.muted} />
							</View>
						) : (
							<Pressable accessibilityLabel={t('Назад')} onPress={() => goBack()} hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
								<BackIcon size={22} color={c.ink} />
							</Pressable>
						)}
						<TextInput
							value={query}
							onChangeText={setQuery}
							onFocus={() => setFocused(true)}
							placeholder={t('Ряд, контейнер, магазин или марка')}
							placeholderTextColor={c.muted}
							returnKeyType="search"
							onSubmitEditing={() => hits[0] && pickHit(hits[0])}
							style={{ flex: 1, height: 48, fontSize: fs.base, fontFamily: fontFamily(500), color: c.ink }}
						/>
						{query ? (
							<Pressable accessibilityLabel={t('Очистить')} onPress={clear} hitSlop={6} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
								<View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
									<CrossIcon size={13} color={c.ink} />
								</View>
							</Pressable>
						) : null}
					</Floating>
				</View>

				{header && !showResults ? header : null}

				{showResults ? (
					<View style={{ paddingHorizontal: 12 }}>
						<Floating style={{ borderRadius: 20, overflow: 'hidden' }}>
							{hits.map((hit, i) => (
								<ResultRow key={hit.kind === 'row' ? `r${hit.rowId}` : `c${hit.container.id}`} first={i === 0} onPress={() => pickHit(hit)}>
									{hit.kind === 'container' ? (
										<>
											<PlacePlate row={hit.rowCode} box={hit.container.number} />
											<View style={{ flex: 1, gap: 1 }}>
												<Text numberOfLines={1} style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: c.ink }}>
													{hit.container.shop?.name ?? t('Контейнер {0}', hit.container.number)}
												</Text>
												<Text numberOfLines={1} style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.muted }}>
													{hit.rowLabel}
												</Text>
											</View>
										</>
									) : (
										<>
											<RowBadge code={hit.rowCode} />
											<View style={{ flex: 1, gap: 1 }}>
												<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: c.ink }}>{hit.rowLabel}</Text>
												<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.muted }}>{t('{0} конт.', hit.containers)}</Text>
											</View>
										</>
									)}
								</ResultRow>
							))}
							{matchedBrands.map((b, i) => (
								<ResultRow key={`b${b.id}`} first={!hits.length && i === 0} onPress={() => pickBrand(b.id)}>
									<BrandLogo brand={b} size={34} />
									<Text numberOfLines={1} style={{ flex: 1, fontSize: fs.base, fontFamily: fontFamily(700), color: c.ink }}>
										{t('Где продают {0}', b.name)}
									</Text>
								</ResultRow>
							))}
							{!hits.length && !matchedBrands.length ? (
								<Text style={{ padding: 16, fontSize: fs.md, lineHeight: 21, fontFamily: fontFamily(500), color: c.muted }}>
									{t('Ничего не нашли. Попробуйте «14 12» — ряд и номер контейнера')}
								</Text>
							) : null}
						</Floating>
					</View>
				) : (
					<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }} keyboardShouldPersistTaps="handled">
						{popular.map((b) => {
							const on = b.id === brandId
							return (
								<Pressable
									key={b.id}
									onPress={() => pickBrand(on ? undefined : b.id)}
									style={{
										flexDirection: 'row',
										alignItems: 'center',
										gap: 6,
										height: 36,
										paddingLeft: 4,
										paddingRight: 12,
										borderRadius: 18,
										backgroundColor: on ? c.brand : c.card,
										shadowColor: fixed.shadow,
										shadowOpacity: 0.12,
										shadowOffset: { width: 0, height: 3 },
										shadowRadius: 8,
										elevation: 3,
									}}
								>
									<View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: fixed.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
										<BrandLogo brand={b} size={24} />
									</View>
									<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: on ? fixed.white : c.ink }}>{b.name}</Text>
								</Pressable>
							)
						})}
					</ScrollView>
				)}

				{/* марка выбрана — что ищем у неё: ходовая, оптика, двигатель… */}
				{brandId && !showResults && categories.length ? (
					<CategoryChips
						scroll
						categories={categories}
						picked={categoryId ? [categoryId] : []}
						onToggle={(id) => {
							setCategoryId((current) => (current === id ? undefined : id))
							setSelectedId(null)
						}}
					/>
				) : null}
			</View>

			{/* справа над шторкой: «Где я» */}
			{sheetHeight > 0 ? (
				<View style={{ position: 'absolute', right: 12, bottom: sheetHeight + 12, gap: 10 }}>
					<RoundButton label={t('Где я')} onPress={() => mapRef.current?.focusOnMe(18.5)}>
						<LocateIcon size={22} color={c.ink} />
					</RoundButton>
				</View>
			) : null}

			{/* шторка: выбранный контейнер → марка → рынок целиком */}
			<View
				onLayout={(event) => setSheetHeight(Math.round(event.nativeEvent.layout.height))}
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					bottom: 0,
					backgroundColor: c.card,
					borderTopLeftRadius: 26,
					borderTopRightRadius: 26,
					paddingTop: 10,
					paddingHorizontal: 16,
					paddingBottom: bottomPad,
					gap: 14,
					shadowColor: fixed.shadow,
					shadowOpacity: 0.12,
					shadowOffset: { width: 0, height: -6 },
					shadowRadius: 16,
					elevation: 10,
				}}
			>
				<View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center' }} />

				{selected ? (
					<>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
							<PlacePlate row={selected.rowCode} box={selected.container.number} size="md" />
							<View style={{ flex: 1, gap: 2 }}>
								<Text numberOfLines={1} style={{ fontSize: fs.xl, fontFamily: fontFamily(800), color: c.ink }}>
									{selected.container.shop?.name ?? t('Контейнер {0}', selected.container.number)}
								</Text>
								<Text numberOfLines={1} style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.muted }}>
									{selected.container.shop?.shopId ? t('Продавец в приложении') : t('Продавца пока нет в приложении')}
								</Text>
							</View>
							<CloseButton onPress={() => setSelectedId(null)} />
						</View>
						<View style={{ flexDirection: 'row', gap: 10 }}>
							{selected.container.shop?.shopId ? (
								<BigButton
									label={t('Продавец')}
									tone="grey"
									height={52}
									icon={<StoreIcon size={20} color={c.ink} />}
									onPress={() => router.push({ pathname: '/seller-profile', params: { id: String(selected.container.shop!.shopId) } })}
									style={{ flex: 1 }}
								/>
							) : null}
							<BigButton
								label={t('Маршрут')}
								height={52}
								icon={<RouteIcon size={20} color={fixed.white} />}
								onPress={() =>
									router.push({
										pathname: '/route',
										params: { containerId: String(selected.container.id), shopName: selected.container.shop?.name ?? undefined },
									})
								}
								style={{ flex: 1 }}
							/>
						</View>
					</>
				) : brandId && highlight ? (
					<>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
							{brand ? (
								<View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: fixed.white, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
									<BrandLogo brand={brand} size={40} />
								</View>
							) : null}
							<View style={{ flex: 1, gap: 2 }}>
								<Text numberOfLines={1} style={{ fontSize: fs.xl, fontFamily: fontFamily(800), color: c.ink }}>
									{highlight.name}
								</Text>
								<Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(500), color: c.muted }}>
									{highlight.containerIds.length
										? t('{0} конт. в {1} рядах — отмечены синим', highlight.containerIds.length, highlight.rowsCount)
										: categoryId
											? t('Продавцов этой марки с такой категорией пока нет в приложении')
											: t('Продавцов этой марки пока нет в приложении')}
								</Text>
							</View>
							<CloseButton onPress={() => pickBrand(undefined)} />
						</View>
						{highlight.nearestContainerId ? (
							<BigButton
								label={t('Ближайший: ряд {0}, конт. {1}', highlight.nearestRow ?? '', highlight.nearestContainer ?? '')}
								height={52}
								icon={<RouteIcon size={20} color={fixed.white} />}
								onPress={() => select(highlight.nearestContainerId!)}
							/>
						) : null}
					</>
				) : (
					<>
						<View style={{ gap: 3 }}>
							<Text style={{ fontSize: fs.xl, fontFamily: fontFamily(800), color: c.ink }}>{t('Рынок Кудайберген')}</Text>
							<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.muted }}>
								{stats.shops
									? t('{0} рядов · {1} контейнеров · {2} продавцов в приложении', stats.rows, stats.containers, stats.shops)
									: t('{0} рядов · {1} контейнеров', stats.rows, stats.containers)}
							</Text>
						</View>
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
							<Legend color={mapPalette.target} border={mapPalette.target} label={t('куда идти')} />
							<Legend color={mapPalette.cellShop} border={mapPalette.cellShopGlow} label={t('продавец в приложении — нажмите')} />
						</View>
					</>
				)}
			</View>
		</View>
	)
}

/** Белая плашка с мягкой тенью поверх карты. */
export function Floating({ style, children }: { style?: object; children: ReactNode }) {
	const c = useColors()
	return (
		<View
			style={[
				{
					backgroundColor: c.card,
					shadowColor: fixed.shadow,
					shadowOpacity: 0.16,
					shadowOffset: { width: 0, height: 6 },
					shadowRadius: 16,
					elevation: 6,
				},
				style,
			]}
		>
			{children}
		</View>
	)
}

function ResultRow({ onPress, first, children }: { onPress: () => void; first: boolean; children: ReactNode }) {
	const c = useColors()
	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => ({
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				minHeight: 60,
				paddingHorizontal: 14,
				backgroundColor: pressed ? c.brandTint : c.card,
				borderTopWidth: first ? 0 : 1,
				borderTopColor: c.border,
			})}
		>
			{children}
		</Pressable>
	)
}

/** Код ряда в круге — для строки «Ряд Ю · 50 конт.» в результатах. */
function RowBadge({ code }: { code: string }) {
	return (
		<View style={{ minWidth: 40, height: 40, paddingHorizontal: 6, borderRadius: 10, backgroundColor: fixed.plate, alignItems: 'center', justifyContent: 'center' }}>
			<Text numberOfLines={1} style={{ fontSize: code.length > 3 ? fs.xs : fs.lg, fontFamily: fontFamily(800), color: fixed.plateInk }}>
				{code}
			</Text>
		</View>
	)
}

function Legend({ color, border, label }: { color: string; border: string; label: string }) {
	const c = useColors()
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
			<View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color, borderWidth: 1.5, borderColor: border }} />
			<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.muted }}>{label}</Text>
		</View>
	)
}

function CloseButton({ onPress }: { onPress: () => void }) {
	const c = useColors()
	return (
		<Pressable accessibilityLabel={t('Закрыть')} onPress={onPress} hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
			<CrossIcon size={16} color={c.ink} />
		</Pressable>
	)
}

export function RoundButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
	return (
		<Pressable accessibilityLabel={label} onPress={onPress}>
			<Floating style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>{children}</Floating>
		</Pressable>
	)
}

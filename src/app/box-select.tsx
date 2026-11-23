import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { askForPushAt } from '@/lib/push'
import { BottomSheet, BrandLogo, Button, QueryErrorBanner, ScreenHeader, toast } from '@/components/ui'
import { BrandTile, Label, PlusIcon, TickIcon } from '@/components/seller-v23'
import { LocateIcon, MarketIcon, SearchIcon, StoreIcon } from '@/components/icons'
import { SelectField, SelectSheet } from '@/components/select-sheet'
import { addressAt, currentCoords } from '@/lib/locate'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { type Side, useAddContainer, useAddRow, useMarkets, useRowContainers, useRows } from '@/api/market'
import { useBrands, useCategories } from '@/api/directory'
import { CategoryChips } from '@/components/category-chips'
import { useMyShop, useRegisterShop, useRelocateShop } from '@/api/shop'
import { useSession } from '@/store/useSession'
import { useClaimContainer } from '@/api/complaints'
import { ApiError } from '@/lib/api'
import type { Brand, Category } from '@/api/types'
import { t } from '@/i18n'
import { KEYBOARD_DONE } from '@/components/keyboard-done'
import { goBack, resetTo } from '@/lib/navigation'

/** Rows in the order of the mockup grid [11]; rows the mockup doesn't know go after them. */
const ROW_ORDER = ['19', '18', '17', '16', '15', '14', '13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '1', t('К'), t('Ц'), t('Л'), t('Н'), t('Я'), t('С'), t('Ж'), t('Д'), t('В'), t('Ю'), t('Х'), t('У')]
/** Latin letters typed for Cyrillic row codes: «K» → «К». */
const LOOKALIKE: Record<string, string> = { A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У' }
/** «ряд к», «Ряд 4», «k» → «К», «4». */
const rowCode = (text: string) =>
	text.trim().replace(/^ряд\s*/i, '').toUpperCase().replace(/[A-Z]/g, (ch) => LOOKALIKE[ch] ?? ch)
const SIDE_NAMES: Record<Side, string> = {
	NORTH: t('Северная сторона'),
	SOUTH: t('Южная сторона'),
	WEST: t('Западная сторона'),
	EAST: t('Восточная сторона'),
}
/** Brand tiles before «Другие» — as in the mockup. */
const TILES = 5
/** Categories before «Другие». */
const CATEGORY_CHIPS = 5

/**
 * 11 «Где вы продаёте» — registration in one minute: on the Кудайберген market (row, container number), on another
 * market without a scheme (Дордой, Дордой Моторс, Геология: the market and the place as text) or a shop / centre
 * elsewhere (name, address, the point by geolocation), then brands → POST /shops.
 * With a shop already — moving to another container (brands are changed in «Мой бокс»).
 */
export default function BoxSelectScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const hasShop = useSession((s) => s.hasShop)
	const shop = useMyShop()
	const rows = useRows()
	const brands = useBrands()
	const register = useRegisterShop()
	const relocate = useRelocateShop()
	const addContainer = useAddContainer()
	const addRow = useAddRow()

	const current = shop.data?.location
	// Both typed: a known row and box are matched, a missing box is added, an unknown row is kept as text.
	const [rowText, setRowText] = useState('')
	const [number, setNumber] = useState('')
	const [side, setSide] = useState<Side | null>(null)
	const [picked, setPicked] = useState<number[]>([])
	// что продаёт — по марке и категории покупатель ищет на карте; можно не выбирать, поправит в «Мой бокс»
	const [pickedCategories, setPickedCategories] = useState<number[]>([])
	const categories = useCategories().data ?? []
	const toggleCategory = (id: number) =>
		setPickedCategories((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
	const [othersOpen, setOthersOpen] = useState(false)
	const [otherCategoriesOpen, setOtherCategoriesOpen] = useState(false)
	// Как с марками: пять на виду, остальные — в «Другие»; выбранные там тоже показываются пилюлями
	const shownCategories = [
		...categories.slice(0, CATEGORY_CHIPS),
		...categories.slice(CATEGORY_CHIPS).filter((category) => pickedCategories.includes(category.id)),
	]
	// «Это мой контейнер» — a taken box that is actually yours.
	const [claim, setClaim] = useState<{ id: number; number: number } | null>(null)
	// «На рынке» — рынок из списка: у Кудайбергена ряд и контейнер, у остальных место текстом;
	// «Магазин или центр» (Kia, Toyota…) — название, адрес и точка.
	const [where, setWhere] = useState<'MARKET' | 'STORE'>('MARKET')
	// Кудайберген (со схемой) первым, дальше по алфавиту
	const marketList = useMarkets().data
	const markets = useMemo(
		() => [...(marketList ?? [])].sort((a, b) => Number(b.hasScheme) - Number(a.hasScheme) || a.name.localeCompare(b.name)),
		[marketList],
	)
	const [pickedMarketId, setMarketId] = useState<number | null>(null)
	const [pickingMarket, setPickingMarket] = useState(false)
	const market = markets.find((item) => item.id === pickedMarketId) ?? markets[0]
	const marketId = market?.id ?? null
	const store = !hasShop && where === 'STORE'
	// рынок без схемы — место текстом; пока список рынков не пришёл, показываем Кудайберген
	const otherMarket = !hasShop && where === 'MARKET' && Boolean(market && !market.hasScheme)
	const [manualPlace, setManualPlace] = useState('')
	const [name, setName] = useState('')
	const [address, setAddress] = useState('')
	const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null)
	const [locating, setLocating] = useState(false)
	const [locateError, setLocateError] = useState<string | null>(null)

	const locate = async () => {
		setLocating(true)
		setLocateError(null)
		try {
			if (!(await Location.requestForegroundPermissionsAsync()).granted) {
				setLocateError(t('Разрешите доступ к геолокации в настройках'))
				return
			}
			const coords = await currentCoords()
			setPoint({ lat: coords.latitude, lng: coords.longitude })
			if (!address.trim()) {
				const address = await addressAt(coords)
				if (address) setAddress(address)
			}
		} catch {
			setLocateError(t('Не удалось определить место — попробуйте ещё раз'))
		} finally {
			setLocating(false)
		}
	}

	const sortedRows = useMemo(() => {
		const rank = (code: string) => (ROW_ORDER.includes(code) ? ROW_ORDER.indexOf(code) : ROW_ORDER.length)
		return [...(rows.data ?? [])].sort((a, b) => rank(a.code) - rank(b.code))
	}, [rows.data])
	const code = rowCode(rowText)
	const row = code ? sortedRows.find((r) => r.code.toUpperCase() === code) : undefined
	// No such row yet — «Добавить ряд» creates it, then it works like any other.
	const missingRow = Boolean(code) && rows.isSuccess && !row
	const detail = useRowContainers(row?.id ?? 0)

	// The side is asked only when the row has two and the number alone doesn't tell which.
	const sides = (detail.data?.sides ?? []).filter((item) => item.containers.length > 0)
	const twoSides = sides.length > 1
	const sideName = (value: Side) => SIDE_NAMES[value]
	const typed = Number(number)
	const matches = row && typed > 0
		? sides.flatMap((item) => item.containers.filter((box) => box.number === typed).map((box) => ({ ...box, side: item.side })))
		: []
	const needSide = twoSides && matches.length !== 1
	const slot = matches.length === 1 && !(needSide && side) ? matches[0] : matches.find((box) => box.side === side)
	// Not in the database yet — added on «Начать».
	const adding = Boolean(row && typed > 0 && detail.isSuccess && !slot && (!needSide || side))
	const taken = slot ? slot.occupied && slot.id !== current?.containerId : false
	const placeError = taken && slot ? t('Контейнер {0} уже занят другим продавцом', slot.number) : null
	const addReady = adding

	const all = brands.data ?? []
	const popular = all.filter((b) => b.popular).slice(0, TILES)
	// Brands picked in «Другие» show up as tiles too.
	const tiles = [...popular, ...all.filter((b) => picked.includes(b.id) && !popular.some((p) => p.id === b.id))]
	const toggle = (id: number) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

	const ready = store
		? Boolean(name.trim() && address.trim() && point && picked.length > 0)
		: otherMarket
			? Boolean(marketId && manualPlace.trim().length >= 2 && picked.length > 0)
			: Boolean((slot ? !taken : addReady) && (hasShop || picked.length > 0))
	const error = register.error ?? relocate.error ?? addContainer.error ?? addRow.error
	const field = {
		height: 52,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: c.border,
		backgroundColor: c.card,
		paddingHorizontal: 16,
		fontSize: fs.lg,
		fontFamily: fontFamily(500),
		color: c.ink,
	} as const

	const submit = () => {
		if (store) {
			if (!point) return
			register.mutate(
				{ name: name.trim(), address: address.trim(), lat: point.lat, lng: point.lng, brandIds: picked, categoryIds: pickedCategories },
				{ onSuccess: (shop) => resetTo(shop.status === 'PENDING_VERIFICATION' ? '/under-review?kind=shop' : '/seller') }
			)
			return
		}
		const done = (shop: { status: string }) =>
			shop.status === 'PENDING_VERIFICATION' ? resetTo('/under-review?kind=shop') : (resetTo('/seller'), askForPushAt('shop'))
		if (otherMarket) {
			if (!marketId) return
			register.mutate(
				{ marketId, manualPlace: manualPlace.trim(), name: name.trim() || undefined, brandIds: picked, categoryIds: pickedCategories },
				{ onSuccess: done }
			)
			return
		}
		const go = (containerId: number) =>
			hasShop
				? relocate.mutate(containerId, { onSuccess: () => (toast(t('Контейнер изменён')), goBack()) })
				: register.mutate({ containerId, brandIds: picked, categoryIds: pickedCategories }, { onSuccess: done })
		if (slot) return go(slot.id)
		if (!addReady || !row) return
		addContainer.mutate({ rowId: row.id, number: typed, side: twoSides ? (side ?? undefined) : undefined }, { onSuccess: (box) => go(box.id) })
	}

	return (
		<View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
			{/* Регистрация: «Назад» — к выбору роли, а не на экраны покупателя. */}
			<ScreenHeader title={hasShop ? t('Ваш контейнер') : t('Где вы продаёте')} onBack={hasShop ? undefined : () => resetTo('/role')} />

			<ScrollView
				contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<QueryErrorBanner error={rows.error ?? detail.error ?? brands.error} onRetry={() => rows.refetch()} />

				{hasShop ? null : (
					<>
						<View style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: c.fill, gap: 4 }}>
							{([
								{ value: 'MARKET', label: t('На рынке'), icon: MarketIcon },
								{ value: 'STORE', label: t('Магазин или центр'), icon: StoreIcon },
							] as const).map(({ value, label, icon: Icon }) => {
								const active = where === value
								return (
									<Pressable
										key={value}
										onPress={() => setWhere(value)}
										accessibilityRole="tab"
										accessibilityState={{ selected: active }}
										style={{
											flex: 1,
											height: 48,
											borderRadius: 12,
											backgroundColor: active ? c.card : 'transparent',
											flexDirection: 'row',
											alignItems: 'center',
											justifyContent: 'center',
											gap: 8,
											shadowColor: fixed.shadow,
											shadowOpacity: active ? 0.08 : 0,
											shadowOffset: { width: 0, height: 2 },
											shadowRadius: 6,
											elevation: active ? 2 : 0,
										}}
									>
										<Icon size={20} color={active ? c.brandStrong : c.muted} />
										<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: fs.base, fontFamily: fontFamily(active ? 700 : 600), color: active ? c.ink : c.muted }}>
											{label}
										</Text>
									</Pressable>
								)
							})}
						</View>
						{where === 'MARKET' && market ? (
							<SelectField
								label={t('Рынок')}
								value={market.name}
								placeholder={t('Выберите рынок')}
								onPress={() => setPickingMarket(true)}
							/>
						) : null}
					</>
				)}

				{otherMarket ? (
					<>
						<Label>{t('Где вы на рынке')}</Label>
						<TextInput inputAccessoryViewID={KEYBOARD_DONE}
							value={manualPlace}
							onChangeText={(text) => setManualPlace(text.slice(0, 60))}
							placeholder={t('Например, ряд 5, контейнер 12')}
							placeholderTextColor={c.fillInk}
							style={field}
						/>
						<Label>{t('Название (можно не писать)')}</Label>
						<TextInput inputAccessoryViewID={KEYBOARD_DONE}
							value={name}
							onChangeText={(text) => setName(text.slice(0, 60))}
							placeholder={t('Например, Автозапчасти Нурлан')}
							placeholderTextColor={c.fillInk}
							style={field}
						/>
					</>
				) : store ? (
					<>
						<Label>{t('Название')}</Label>
						<TextInput inputAccessoryViewID={KEYBOARD_DONE}
							value={name}
							onChangeText={(text) => setName(text.slice(0, 60))}
							placeholder={t('Например, Kia Центр Бишкек')}
							placeholderTextColor={c.fillInk}
							style={field}
						/>
						<Label>{t('Адрес')}</Label>
						<TextInput inputAccessoryViewID={KEYBOARD_DONE}
							value={address}
							onChangeText={(text) => setAddress(text.slice(0, 160))}
							placeholder={t('ул. Ленина 45')}
							placeholderTextColor={c.fillInk}
							style={field}
						/>
						<Pressable
							onPress={locate}
							disabled={locating}
							style={{ height: 48, borderRadius: 14, backgroundColor: point ? c.successSoft : c.brandTint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
						>
							<LocateIcon size={20} color={point ? c.success : c.brandStrong} />
							<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: point ? c.success : c.brandStrong }}>
								{locating ? t('Определяем…') : point ? t('Точка определена — обновить') : t('Отметить по геолокации')}
							</Text>
						</Pressable>
						{locateError ? (
							<Text style={{ fontSize: fs.md, lineHeight: 19, fontFamily: fontFamily(400), color: c.danger }}>{locateError}</Text>
						) : null}
					</>
				) : (
					<>
						<Label>{t('Ряд')}</Label>
						<TextInput inputAccessoryViewID={KEYBOARD_DONE}
							value={rowText}
							onChangeText={(text) => {
								setRowText(text.slice(0, 12))
								setSide(null)
							}}
							autoCapitalize="characters"
							autoCorrect={false}
							placeholder={t('Например, 4 или К')}
							placeholderTextColor={c.fillInk}
							style={field}
						/>
						<Label>{t('Номер контейнера')}</Label>
						<TextInput inputAccessoryViewID={KEYBOARD_DONE}
							value={number}
							onChangeText={(text) => {
								setNumber(text.replace(/\D/g, '').slice(0, 3))
								setSide(null)
							}}
							keyboardType="number-pad"
							placeholder={t('Например, 12')}
							placeholderTextColor={c.fillInk}
							style={field}
						/>
						{row && typed > 0 && needSide ? (
							<View style={{ flexDirection: 'row', gap: 8 }}>
								{sides.map(({ side: value }) => {
									const active = side === value
									return (
										<Pressable
											key={value}
											onPress={() => setSide(value)}
											style={{
												flex: 1,
												height: 44,
												borderRadius: 12,
												borderWidth: 1.5,
												borderColor: active ? c.brand : c.border,
												backgroundColor: active ? c.brand : c.card,
												alignItems: 'center',
												justifyContent: 'center',
											}}
										>
											<Text style={{ fontSize: fs.md, fontFamily: fontFamily(active ? 700 : 600), color: active ? fixed.white : c.ink }}>
												{sideName(value)}
											</Text>
										</Pressable>
									)
								})}
							</View>
						) : null}
						{missingRow ? (
							<View style={{ gap: 8 }}>
								<Text style={{ fontSize: fs.md, lineHeight: 19, fontFamily: fontFamily(500), color: c.muted }}>
									{t('Ряда {0} у нас пока нет', code)}
								</Text>
								<Pressable
									onPress={() => addRow.mutate(code)}
									disabled={addRow.isPending}
									style={{ height: 48, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: c.dashedBrand, backgroundColor: c.brandTint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: addRow.isPending ? 0.6 : 1 }}
								>
									<PlusIcon size={18} color={c.brandStrong} />
									<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: c.brandStrong }}>
										{addRow.isPending ? t('Добавляем…') : t('Добавить ряд {0}', code)}
									</Text>
								</Pressable>
							</View>
						) : null}
						{row && typed > 0 && !placeError ? (
							<Text style={{ fontSize: fs.md, lineHeight: 19, fontFamily: fontFamily(500), color: slot ? c.success : c.muted }}>
								{needSide && !side
									? t('Выберите сторону ряда')
									: slot
										? t('{0} · конт. {1} — нашли', row.label, typed)
										: adding
											? t('Контейнера {0} ещё нет — добавим его в {1}', typed, row.label)
											: null}
							</Text>
						) : null}
						{placeError ? (
							<View style={{ gap: 4 }}>
								<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.danger }}>{placeError}</Text>
								{taken && slot ? (
									<Text
										onPress={() => setClaim({ id: slot.id, number: slot.number })}
										style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}
									>{t('Это мой контейнер')}</Text>
								) : null}
							</View>
						) : null}

					</>
				)}

				{hasShop ? null : (
					<>
						<Label>{t('Какие марки продаёте')}</Label>
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
							{tiles.map((brand) => (
								<BrandTile key={brand.id} brand={brand} active={picked.includes(brand.id)} onPress={() => toggle(brand.id)} />
							))}
							<Pressable
								onPress={() => setOthersOpen(true)}
								style={{
									flexBasis: '31%',
									flexGrow: 1,
									minHeight: 82,
									borderRadius: 14,
									borderWidth: 2,
									borderStyle: 'dashed',
									borderColor: c.dashedBrand,
									alignItems: 'center',
									justifyContent: 'center',
									gap: 4,
								}}
							>
								<PlusIcon size={20} color={c.brandStrong} />
								<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('Другие')}</Text>
							</Pressable>
						</View>

						{categories.length ? (
							<>
								<Label>{t('Что продаёте')}</Label>
								<View style={{ gap: 8 }}>
									<CategoryChips categories={shownCategories} picked={pickedCategories} onToggle={toggleCategory} />
									{categories.length > CATEGORY_CHIPS ? (
										<Pressable
											onPress={() => setOtherCategoriesOpen(true)}
											accessibilityRole="button"
											style={{ alignSelf: 'flex-start', height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: c.dashedBrand, flexDirection: 'row', alignItems: 'center', gap: 6 }}
										>
											<PlusIcon size={16} color={c.brandStrong} />
											<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: c.brandStrong }}>
												{t('Другие · {0}', categories.length - CATEGORY_CHIPS)}
											</Text>
										</Pressable>
									) : null}
								</View>
							</>
						) : null}
					</>
				)}

				{error ? <Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.danger }}>{error.message}</Text> : null}
			</ScrollView>

			{pickingMarket ? (
				<SelectSheet
					title={t('Рынок')}
					options={markets.map((item) => ({
						key: item.id,
						label: item.name,
						sub: item.hasScheme ? t('Ряд и номер контейнера') : t('Место напишете сами'),
					}))}
					selected={marketId}
					onPick={setMarketId}
					onClose={() => setPickingMarket(false)}
				/>
			) : null}

			{otherCategoriesOpen ? (
				<OtherCategories categories={categories} picked={pickedCategories} onToggle={toggleCategory} onClose={() => setOtherCategoriesOpen(false)} />
			) : null}

			{othersOpen ? (
				<OtherBrands brands={all} picked={picked} onToggle={toggle} onClose={() => setOthersOpen(false)} />
			) : (
				<View
					style={{
						paddingTop: 12,
						paddingHorizontal: 16,
						paddingBottom: Math.max(28, insets.bottom + 12),
						backgroundColor: c.card,
						borderTopWidth: 1,
						borderTopColor: c.hairline,
					}}
				>
					<Button
						label={hasShop ? t('Переехать сюда') : t('Начать получать запросы')}
						disabled={!ready}
						loading={register.isPending || relocate.isPending || addContainer.isPending}
						onPress={submit}
					/>
				</View>
			)}

			<ClaimSheet
				box={claim && row ? { ...claim, place: t('{0} · конт. {1}', row.label, claim.number) } : null}
				onClose={() => setClaim(null)}
				onFree={(free) => {
					setClaim(null)
					setNumber(String(free.number))
				}}
			/>
		</View>
	)
}

/** «Другие» — all brands A–Я with search. */
/** «Что продаёте» → «Другие»: все категории с галочками, как «Все марки». */
function OtherCategories({
	categories,
	picked,
	onToggle,
	onClose,
}: {
	categories: Category[]
	picked: number[]
	onToggle: (id: number) => void
	onClose: () => void
}) {
	const c = useColors()
	return (
		<BottomSheet
			onClose={onClose}
			maxHeight={0.8}
			header={<Text style={{ fontSize: fs.h3, fontFamily: fontFamily(800), color: c.ink }}>{t('Что продаёте')}</Text>}
			footer={<Button label={picked.length ? t('Готово · {0}', picked.length) : t('Готово')} onPress={onClose} />}
		>
			{categories.map((category) => {
				const active = picked.includes(category.id)
				return (
					<Pressable
						key={category.id}
						onPress={() => onToggle(category.id)}
						accessibilityRole="checkbox"
						accessibilityState={{ checked: active }}
						style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 12 }}
					>
						<Text style={{ flex: 1, fontSize: fs.lg, fontFamily: fontFamily(active ? 600 : 400), color: c.ink }}>{category.name}</Text>
						<View
							style={{
								width: 24,
								height: 24,
								borderRadius: 7,
								borderWidth: 2,
								borderColor: active ? c.brand : c.border,
								backgroundColor: active ? c.brand : 'transparent',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							{active ? <TickIcon size={14} color={fixed.white} strokeWidth={3} /> : null}
						</View>
					</Pressable>
				)
			})}
		</BottomSheet>
	)
}

function OtherBrands({
	brands,
	picked,
	onToggle,
	onClose,
}: {
	brands: Brand[]
	picked: number[]
	onToggle: (id: number) => void
	onClose: () => void
}) {
	const c = useColors()
	const [q, setQ] = useState('')
	const query = q.trim().toLowerCase()
	// The server knows folk names («мерс», «бэха», «тойота»); the local match covers the moment before it answers.
	const found = useBrands(query ? { q: q.trim() } : {})
	const list = query
		? found.data && !found.isPlaceholderData
			? found.data
			: brands.filter((b) => b.name.toLowerCase().includes(query) || b.shortName.toLowerCase().includes(query))
		: brands

	return (
		<BottomSheet
			onClose={onClose}
			maxHeight={0.8}
			header={
				<View style={{ gap: 12 }}>
					<Text style={{ fontSize: fs.h3, fontFamily: fontFamily(800), color: c.ink }}>{t('Все марки')}</Text>
					<View
						style={{
							height: 48,
							borderRadius: 12,
							backgroundColor: c.surface,
							flexDirection: 'row',
							alignItems: 'center',
							gap: 10,
							paddingHorizontal: 12,
						}}
					>
						<SearchIcon size={20} color={c.muted} strokeWidth={2.4} />
						<TextInput inputAccessoryViewID={KEYBOARD_DONE}
							value={q}
							onChangeText={setQ}
							placeholder={t('Найти марку')}
							placeholderTextColor={c.fillInk}
							style={{ flex: 1, fontSize: fs.lg, fontFamily: fontFamily(400), color: c.ink, padding: 0 }}
						/>
					</View>
				</View>
			}
			footer={<Button label={picked.length ? t('Готово · {0}', picked.length) : t('Готово')} onPress={onClose} />}
		>
			{list.map((brand) => {
				const active = picked.includes(brand.id)
				return (
					<Pressable key={brand.id} onPress={() => onToggle(brand.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
						<BrandLogo brand={brand} size={34} />
						<Text style={{ flex: 1, fontSize: fs.lg, fontFamily: fontFamily(400), color: c.ink }}>{brand.name}</Text>
						<View
							style={{
								width: 24,
								height: 24,
								borderRadius: 7,
								borderWidth: 2,
								borderColor: active ? c.brand : c.border,
								backgroundColor: active ? c.brand : 'transparent',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							{active ? <TickIcon size={14} color={fixed.white} strokeWidth={3} /> : null}
						</View>
					</Pressable>
				)
			})}
		</BottomSheet>
	)
}

/**
 * «Это мой контейнер» — no mockup; a sheet in the style of 09. POST /market/containers/{id}/claim → the dispute goes
 * to the administration, the answer comes as a DISPUTE_RESOLVED push. 409 CONTAINER_FREE — the box is free after all.
 */
function ClaimSheet({
	box,
	onClose,
	onFree,
}: {
	box: { id: number; number: number; place: string } | null
	onClose: () => void
	onFree: (box: { id: number; number: number }) => void
}) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const claim = useClaimContainer()
	const [text, setText] = useState('')
	const code = claim.error instanceof ApiError ? claim.error.code : null

	const close = () => {
		claim.reset()
		setText('')
		onClose()
	}

	return (
		<Modal visible={box !== null} transparent animationType="slide" onRequestClose={close}>
			<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={close} />
				<View style={{ backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28 + insets.bottom, gap: 14 }}>
					{claim.isSuccess ? (
						<>
							<Text style={{ fontSize: fs.h3, fontFamily: fontFamily(700), color: c.ink }}>{t('Заявка на спор отправлена')}</Text>
							<Text style={{ fontSize: fs.base, lineHeight: 23, fontFamily: fontFamily(400), color: c.muted }}>{t('Администрация рынка проверит, чей это контейнер, и пришлёт пуш с решением.')}</Text>
							<Button label={t('Понятно')} onPress={close} />
						</>
					) : (
						<>
							<Text style={{ fontSize: fs.h3, fontFamily: fontFamily(700), color: c.ink }}>{t('{0} занят', box?.place ?? ' ')}</Text>
							<Text style={{ fontSize: fs.base, lineHeight: 23, fontFamily: fontFamily(400), color: c.muted }}>{t('Если это ваш контейнер, а в приложении его занял другой продавец, — откройте спор. Администрация рынка разберётся.')}</Text>
							<TextInput inputAccessoryViewID={KEYBOARD_DONE}
								value={text}
								onChangeText={(v) => setText(v.slice(0, 500))}
								placeholder={t('Комментарий — необязательно: с какого года аренда, договор…')}
								placeholderTextColor={c.fillInk}
								multiline
								style={{ minHeight: 72, borderRadius: 12, borderWidth: 2, borderColor: c.border, paddingVertical: 10, paddingHorizontal: 14, fontSize: fs.base, fontFamily: fontFamily(400), color: c.ink, textAlignVertical: 'top' }}
							/>
							{claim.error ? (
								<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.danger }}>{claim.error.message}</Text>
							) : null}
							{code === 'CONTAINER_FREE' && box ? (
								<Button label={t('Занять этот контейнер')} variant="secondary" onPress={() => onFree({ id: box.id, number: box.number })} />
							) : (
								<Button
									label={t('Это мой контейнер')}
									loading={claim.isPending}
									disabled={code === 'OWN_CONTAINER'}
									onPress={() => box && claim.mutate({ containerId: box.id, text: text.trim() || undefined })}
								/>
							)}
						</>
					)}
				</View>
			</KeyboardAvoidingView>
		</Modal>
	)
}

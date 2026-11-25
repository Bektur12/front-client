import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { ModalSheet } from '@/components/master-v23'
import { MarketLetter, OFF_MARKET } from '@/components/market-chips'
import { BrandLogo } from '@/components/ui/brand'
import { Skeleton } from '@/components/ui'
import { CheckIcon, ChevronLeftIcon, MapPinIcon, PlusIcon, SearchIcon, StoreIcon } from '@/components/icons'
import { CategoryBadge, CategoryIcon, GridToggleIcon } from '@/components/category-icons'
import { useMarkets } from '@/api/market'
import { haptic } from '@/lib/haptics'
import type { Brand, Car, Category } from '@/api/types'
import { fixed, fontFamily, fs, sectionTitle, useColors } from '@/theme'
import { t } from '@/i18n'

/**
 * Вкладка «Запчасти» без перегруза: вместо пяти лент вбок — две кнопки «для какой машины» и «на каком рынке»
 * (выбор в шторке снизу, как адрес в такси) и сетка категорий с иконками. Глаз сразу видит, куда нажать.
 */

/** Видно сразу — две строки по три: пять самых частых и «Ещё». Остальное — по нажатию. */
const COLLAPSED = 5
const COLUMNS = 3

/** Сетка категорий 4 в ряд: крупная иконка, подпись в две строки. */
export function CategoryGrid({ categories, loading, onPick }: { categories: Category[]; loading?: boolean; onPick: (id: number) => void }) {
	const [open, setOpen] = useState(false)
	if (loading && !categories.length) {
		return (
			<Grid>
				{Array.from({ length: COLUMNS * 2 }, (_, i) => (
					<Skeleton key={i} width="100%" height={86} radius={18} />
				))}
			</Grid>
		)
	}
	const shown = open || categories.length <= COLLAPSED + 1 ? categories : categories.slice(0, COLLAPSED)
	const hidden = categories.length - shown.length
	return (
		<Grid>
			{shown.map((category) => (
				<Tile
					key={category.id}
					slug={category.slug}
					label={category.name}
					onPress={() => {
						haptic.select()
						onPick(category.id)
					}}
				/>
			))}
			{hidden > 0 ? (
				<Tile toggle="more" label={t('Ещё {0}', hidden)} onPress={() => setOpen(true)} />
			) : open && categories.length > COLLAPSED + 1 ? (
				<Tile toggle="less" label={t('Свернуть')} onPress={() => setOpen(false)} />
			) : null}
			{/* пустые ячейки держат последний ряд по сетке */}
			{Array.from({ length: (COLUMNS - ((shown.length + (hidden > 0 || open ? 1 : 0)) % COLUMNS)) % COLUMNS }, (_, i) => (
				<View key={`gap-${i}`} style={{ width: TILE_WIDTH }} />
			))}
		</Grid>
	)
}

/** Ширина плитки: три в ряд с зазором. */
const TILE_WIDTH = '31.6%' as const

function Grid({ children }: { children: ReactNode }) {
	return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>{children}</View>
}

/** Плитка категории: линейная иконка на светлом круге, подпись в две строки; `toggle` — «Ещё 14» / «Свернуть». */
function Tile({ slug, toggle, label, onPress }: { slug?: string; toggle?: 'more' | 'less'; label: string; onPress: () => void }) {
	const c = useColors()
	const accent = Boolean(toggle)
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={label}
			// обычный стиль, не функция: так надёжно и на iPhone, и в браузере
			style={{
				width: TILE_WIDTH,
				// одна высота у всех плиток: подпись в 1 и в 2 строки — ряды ровные
				height: 118,
				borderRadius: 18,
				paddingTop: 14,
				paddingBottom: 12,
				paddingHorizontal: 6,
				alignItems: 'center',
				gap: 9,
				backgroundColor: c.surface,
				borderWidth: 1,
				borderColor: c.border,
			}}
		>
			{toggle ? (
				<View style={{ width: 48, height: 48, borderRadius: 14.4, backgroundColor: c.brandTint, alignItems: 'center', justifyContent: 'center' }}>
					<GridToggleIcon open={toggle === 'less'} size={24} color={c.brandStrong} />
				</View>
			) : (
				<CategoryBadge slug={slug ?? ''} />
			)}
			<Text numberOfLines={2} style={{ minHeight: 32, fontSize: fs.xs, lineHeight: 16, textAlign: 'center', fontFamily: fontFamily(600), color: accent ? c.brandStrong : c.ink }}>
				{label}
			</Text>
		</Pressable>
	)
}

/** «‹ Тормоза» — выбранная категория вместо сетки; стрелка возвращает к категориям. */
export function CategoryBack({ category, onBack }: { category: Category; onBack: () => void }) {
	const c = useColors()
	return (
		<Pressable onPress={onBack} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
			<View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
				<ChevronLeftIcon size={18} color={c.ink} />
			</View>
			<CategoryBadge slug={category.slug} size={34} />
			<Text numberOfLines={1} style={{ flex: 1, fontSize: fs.h3, fontFamily: fontFamily(800), letterSpacing: -0.3, color: c.ink }}>
				{category.name}
			</Text>
		</Pressable>
	)
}

/** Кнопка-контекст «Camry 40 ▾»: что выбрано и что можно сменить. */
function ContextPill({ icon, label, active, onPress }: { icon: ReactNode; label: string; active: boolean; onPress: () => void }) {
	const c = useColors()
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			style={{
				flex: 1,
				minWidth: 0,
				height: 44,
				borderRadius: 14,
				paddingLeft: 6,
				paddingRight: 10,
				flexDirection: 'row',
				alignItems: 'center',
				gap: 8,
				backgroundColor: active ? c.brandTint : c.card,
			}}
		>
			<View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
			<Text numberOfLines={1} style={{ flex: 1, fontSize: fs.md, fontFamily: fontFamily(700), color: active ? c.brandInk : c.ink }}>
				{label}
			</Text>
			<Text style={{ fontSize: fs.sm, color: active ? c.brandStrong : c.muted }}>▾</Text>
		</Pressable>
	)
}

export interface CarChoice {
	cars: Car[]
	carId: number | null
	brand: Brand | null
	modelLabel: string | null
	isMaster: boolean
	pickCar: (id: number) => void
	pickBrand: (brand: Brand | null) => void
}

/** Две кнопки в ряд: «для какой машины» и «на каком рынке». */
export function ContextRow({ car, marketId, onMarket }: { car: CarChoice; marketId: number | null; onMarket: (id: number | null) => void }) {
	const c = useColors()
	const [sheet, setSheet] = useState<'car' | 'market' | null>(null)
	const markets = useMarkets().data ?? []

	const garageCar = car.carId != null ? car.cars.find((item) => item.id === car.carId) : undefined
	const brand = garageCar?.brand ?? (car.carId == null ? car.brand : null)
	const carLabel = garageCar
		? garageCar.label
		: car.carId == null && car.brand
			? (car.modelLabel ?? car.brand.shortName)
			: car.isMaster
				? t('Марка клиента')
				: t('Все машины')

	const market = markets.find((m) => m.id === marketId)
	const marketLabel = market ? market.name : marketId === OFF_MARKET ? t('Магазины и центры') : t('Все рынки')

	const close = () => setSheet(null)
	// Шторка закрывается, потом переход: на iOS новый экран поверх закрывающегося окна не открывается.
	const after = (action: () => void) => {
		close()
		setTimeout(action, 250)
	}

	return (
		<>
			<View style={{ flexDirection: 'row', gap: 8 }}>
				<ContextPill
					icon={brand ? <BrandLogo brand={brand} size={28} /> : <CategoryIcon slug="body" size={22} color={c.muted} />}
					label={carLabel}
					active={Boolean(brand)}
					onPress={() => setSheet('car')}
				/>
				<ContextPill
					icon={market ? <MarketLetter code={market.code} size="sm" /> : marketId === OFF_MARKET ? <StoreIcon size={20} color={c.brandStrong} /> : <MapPinIcon size={20} color={c.muted} />}
					label={marketLabel}
					active={marketId != null}
					onPress={() => setSheet('market')}
				/>
			</View>

			{sheet === 'car' ? (
				<ModalSheet onClose={close}>
					<SheetTitle>{t('Для какой машины?')}</SheetTitle>
					{car.cars.map((item) => (
						<Option
							key={item.id}
							icon={<BrandLogo brand={item.brand} size={32} />}
							label={item.label}
							sub={item.year ? String(item.year) : undefined}
							selected={car.carId === item.id}
							onPress={() => {
								car.pickCar(item.id)
								close()
							}}
						/>
					))}
					<Option
						icon={<SearchIcon size={22} color={c.brandStrong} />}
						label={car.carId == null && car.brand ? t('Другая марка: {0}', car.modelLabel ?? car.brand.shortName) : t('Другая марка или модель')}
						selected={car.carId == null && Boolean(car.brand)}
						onPress={() => after(() => router.push('/pick-brand'))}
					/>
					<Option
						icon={<CategoryIcon slug="body" size={24} color={c.brandStrong} />}
						label={t('Все машины')}
						sub={t('Показать все запчасти')}
						selected={car.carId == null && !car.brand}
						onPress={() => {
							car.pickBrand(null)
							close()
						}}
					/>
					{!car.cars.length && !car.isMaster ? (
						<Option
							icon={<PlusIcon size={20} color={c.brandStrong} />}
							label={t('Добавить мою машину')}
							sub={t('Сначала покажем то, что к ней подходит')}
							onPress={() => after(() => router.push('/garage-add'))}
						/>
					) : null}
				</ModalSheet>
			) : null}

			{sheet === 'market' ? (
				<ModalSheet onClose={close}>
					<SheetTitle>{t('Где искать?')}</SheetTitle>
					<Option
						icon={<MapPinIcon size={22} color={c.brandStrong} />}
						label={t('Все рынки')}
						sub={t('Везде, где есть продавцы')}
						selected={marketId == null}
						onPress={() => {
							onMarket(null)
							close()
						}}
					/>
					{markets.map((item) => (
						<Option
							key={item.id}
							icon={<MarketLetter code={item.code} />}
							label={item.name}
							selected={marketId === item.id}
							onPress={() => {
								onMarket(item.id)
								close()
							}}
						/>
					))}
					<Option
						icon={<StoreIcon size={22} color={c.brandStrong} />}
						label={t('Магазины и центры')}
						sub={t('Вне рынков')}
						selected={marketId === OFF_MARKET}
						onPress={() => {
							onMarket(OFF_MARKET)
							close()
						}}
					/>
				</ModalSheet>
			) : null}
		</>
	)
}

function SheetTitle({ children }: { children: string }) {
	const c = useColors()
	return <Text style={{ fontSize: fs.h3, fontFamily: fontFamily(800), letterSpacing: -0.3, color: c.ink, paddingTop: 4, paddingBottom: 2 }}>{children}</Text>
}

function Option({ icon, label, sub, selected, onPress }: { icon: ReactNode; label: string; sub?: string; selected?: boolean; onPress: () => void }) {
	const c = useColors()
	return (
		<Pressable
			onPress={() => {
				haptic.select()
				onPress()
			}}
			accessibilityRole="radio"
			accessibilityState={{ checked: Boolean(selected) }}
			style={{
				minHeight: 60,
				borderRadius: 16,
				paddingHorizontal: 12,
				paddingVertical: 8,
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				backgroundColor: selected ? c.brandTint : c.surface,
				borderWidth: 2,
				borderColor: selected ? c.brand : 'transparent',
			}}
		>
			<View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
			<View style={{ flex: 1, gap: 2 }}>
				<Text numberOfLines={1} style={{ fontSize: fs.lg, fontFamily: fontFamily(700), color: c.ink }}>{label}</Text>
				{sub ? <Text numberOfLines={1} style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.muted }}>{sub}</Text> : null}
			</View>
			{selected ? (
				<View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
					<CheckIcon size={13} color={fixed.white} strokeWidth={3} />
				</View>
			) : null}
		</Pressable>
	)
}

/** Подпись раздела над сеткой. */
export function GroupTitle({ children }: { children: string }) {
	const c = useColors()
	return <Text style={{ ...sectionTitle, color: c.inkSecondary }}>{children}</Text>
}

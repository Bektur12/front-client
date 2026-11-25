import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { Skeleton } from '@/components/ui'
import { BrandLogo } from '@/components/ui/brand'
import { CategoryBadge } from '@/components/category-icons'
import { useRequestHints } from '@/api/requests'
import { Caps, CameraV23Icon, MicV23Icon } from '@/components/buyer-v23'
import { SearchIcon } from '@/components/icons'
import { SelectSheet } from '@/components/select-sheet'
import { KEYBOARD_DONE } from '@/components/keyboard-done'
import { requireSignIn } from '@/components/sign-in-prompt'
import { useBrands, useCategories } from '@/api/directory'
import { useMakePrimaryCar } from '@/api/garage'
import type { Brand, Car } from '@/api/types'
import { useCatalogFilters } from '@/store/useCatalogFilters'
import { useRecentSearches } from '@/store/useRecentSearches'
import { haptic } from '@/lib/haptics'
import { fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

/** Opens the «Запчасти» tab with what the home screen picked: text, category or brand. */
function openCatalog(patch: { q?: string; categoryId?: number; brand?: Brand }) {
	const f = useCatalogFilters.getState()
	f.setQ(patch.q ?? '')
	f.setCategory(patch.categoryId ?? null)
	if (patch.brand) f.pickBrand(patch.brand)
	router.navigate('/buyer/parts')
}

/** «Название или номер детали…» — Enter opens the catalog with the text; camera and voice go straight to sellers. */
export function HomeSearch({ carId }: { carId?: number }) {
	const c = useColors()
	const [text, setText] = useState('')
	const recent = useRecentSearches()
	const ask = (start: 'camera' | 'voice') =>
		requireSignIn() && router.push({ pathname: '/search-part', params: { carId: carId ? String(carId) : undefined, start } })
	return (
		<View
			style={{
				height: 52,
				borderRadius: 14,
				backgroundColor: c.card,
				flexDirection: 'row',
				alignItems: 'center',
				gap: 10,
				paddingLeft: 14,
				paddingRight: 4,
			}}
		>
			<SearchIcon size={20} color={c.muted} strokeWidth={2.4} />
			<TextInput
				inputAccessoryViewID={KEYBOARD_DONE}
				value={text}
				onChangeText={setText}
				placeholder={t('Название или номер детали')}
				placeholderTextColor={c.fillInk}
				returnKeyType="search"
				onSubmitEditing={() => {
					const q = text.trim()
					if (!q) return
					recent.add(q)
					setText('')
					openCatalog({ q })
				}}
				style={{ flex: 1, minWidth: 0, fontSize: fs.lg, fontFamily: fontFamily(400), color: c.ink, padding: 0 }}
			/>
			<Pressable onPress={() => ask('camera')} accessibilityRole="button" accessibilityLabel={t('Найти по фото')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
				<CameraV23Icon size={22} color={c.brandStrong} />
			</Pressable>
			<Pressable onPress={() => ask('voice')} accessibilityRole="button" accessibilityLabel={t('Сказать голосом')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
				<MicV23Icon size={22} color={c.brandStrong} />
			</Pressable>
		</View>
	)
}

const ADD_CAR = -1

/** «Camry 50 · 2012 ▾» under the greeting: tap — pick another car from the garage or add one. */
export function CarSwitch({ cars, car }: { cars: Car[]; car?: Car }) {
	const c = useColors()
	const [open, setOpen] = useState(false)
	const makePrimary = useMakePrimaryCar()
	if (!car) {
		return (
			<Pressable onPress={() => requireSignIn(t('Чтобы сохранить машину в гараж, войдите по номеру телефона.')) && router.push('/garage-add')} hitSlop={8} accessibilityRole="button">
				<Text style={{ fontSize: fs.md, fontFamily: fontFamily(600), color: c.brandStrong }}>{t('+ Добавить машину')}</Text>
			</Pressable>
		)
	}
	return (
		<>
			<Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('Сменить машину')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
				<BrandLogo brand={car.brand} size={20} />
				<Text numberOfLines={1} style={{ flexShrink: 1, fontSize: fs.md, fontFamily: fontFamily(600), color: c.inkSecondary }}>
					{`${car.title} · ${car.year}`}
				</Text>
				<Text style={{ fontSize: fs.sm, color: c.muted }}>▾</Text>
			</Pressable>
			{open ? (
				<SelectSheet<number>
					title={t('Моя машина')}
					options={[...cars.map((item) => ({ key: item.id, label: item.title, sub: String(item.year) })), { key: ADD_CAR, label: t('+ Добавить машину') }]}
					selected={car.id}
					onPick={(key) => {
						setOpen(false)
						if (key === ADD_CAR) router.push('/garage-add')
						else if (key !== car.id) makePrimary.mutate(key)
					}}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	)
}

/** Categories in one row that scrolls sideways — tap opens the catalog in that category. */
export function CategoryCarousel() {
	const c = useColors()
	const categories = useCategories()
	const list = categories.data ?? []
	if (!list.length && !categories.isLoading) return null
	return (
		<View style={{ gap: 10 }}>
			<Caps large link={t('Все')} onLink={() => openCatalog({})}>{t('Категории')}</Caps>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
				{list.length
					? list.map((category) => (
							<Pressable
								key={category.id}
								onPress={() => {
									haptic.select()
									openCatalog({ categoryId: category.id })
								}}
								accessibilityRole="button"
								accessibilityLabel={category.name}
								style={{ width: 104, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 8, alignItems: 'center', gap: 10 }}
							>
								<CategoryBadge slug={category.slug} size={56} />
								<Text numberOfLines={2} style={{ minHeight: 36, fontSize: fs.sm, lineHeight: 18, textAlign: 'center', fontFamily: fontFamily(600), color: c.ink }}>
									{category.name}
								</Text>
							</Pressable>
						))
					: Array.from({ length: 4 }, (_, i) => <Skeleton key={i} width={104} height={124} radius={18} />)}
			</ScrollView>
		</View>
	)
}

/** Popular brands — logos in a row; tap opens the catalog for that brand. */
export function BrandCarousel() {
	const c = useColors()
	const brands = useBrands({ popular: true })
	const list = brands.data ?? []
	if (!list.length) return null
	return (
		<View style={{ gap: 10 }}>
			<Caps large>{t('Марки')}</Caps>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
				{list.map((brand) => (
					<Pressable
						key={brand.id}
						onPress={() => {
							haptic.select()
							openCatalog({ brand })
						}}
						accessibilityRole="button"
						accessibilityLabel={brand.name}
						style={{ width: 84, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingVertical: 12, alignItems: 'center', gap: 8 }}
					>
						<BrandLogo brand={brand} size={44} />
						<Text numberOfLines={1} style={{ maxWidth: 76, fontSize: fs.sm, fontFamily: fontFamily(600), color: c.ink }}>
							{brand.shortName || brand.name}
						</Text>
					</Pressable>
				))}
			</ScrollView>
		</View>
	)
}

interface Trend {
	text: string
	/** Category icon slug. */
	slug: string
}

/** What drivers in Bishkek look for in each season — shown first, before the server's «часто ищут». */
const SEASON: Record<'winter' | 'spring' | 'summer' | 'autumn', Trend[]> = {
	winter: [
		{ text: t('Аккумулятор'), slug: 'batteries' },
		{ text: t('Зимние шины'), slug: 'tires' },
		{ text: t('Антифриз'), slug: 'oils' },
		{ text: t('Свечи'), slug: 'engine' },
		{ text: t('Дворники'), slug: 'glass' },
		{ text: t('Радиатор печки'), slug: 'climate' },
	],
	spring: [
		{ text: t('Летние шины'), slug: 'tires' },
		{ text: t('Амортизаторы'), slug: 'suspension' },
		{ text: t('Колодки'), slug: 'brakes' },
		{ text: t('Моторное масло'), slug: 'oils' },
		{ text: t('Фильтр салона'), slug: 'climate' },
	],
	summer: [
		{ text: t('Компрессор кондиционера'), slug: 'climate' },
		{ text: t('Радиатор'), slug: 'cooling' },
		{ text: t('Летние шины'), slug: 'tires' },
		{ text: t('Моторное масло'), slug: 'oils' },
		{ text: t('Фильтр салона'), slug: 'climate' },
	],
	autumn: [
		{ text: t('Зимние шины'), slug: 'tires' },
		{ text: t('Аккумулятор'), slug: 'batteries' },
		{ text: t('Антифриз'), slug: 'oils' },
		{ text: t('Дворники'), slug: 'glass' },
		{ text: t('Фара'), slug: 'lights' },
	],
}

function season(month: number) {
	if (month === 11 || month <= 1) return SEASON.winter
	if (month <= 4) return SEASON.spring
	if (month <= 7) return SEASON.summer
	return SEASON.autumn
}

/**
 * «Актуальное сегодня» — the season's parts first, then what is asked most for this car (server hints, 90 days).
 * Tap opens the catalog with that text.
 */
export function TrendingToday({ carId, signedIn }: { carId?: number; signedIn: boolean }) {
	const c = useColors()
	const categories = useCategories().data ?? []
	const hints = useRequestHints(carId, 8, signedIn)
	const slugOf = (categoryId: number | null) => categories.find((item) => item.id === categoryId)?.slug ?? 'other'
	const items: Trend[] = []
	for (const item of [...season(new Date().getMonth()), ...(hints.data ?? []).map((hint) => ({ text: hint.text, slug: slugOf(hint.categoryId) }))]) {
		if (items.length < 10 && !items.some((have) => have.text.toLowerCase() === item.text.toLowerCase())) items.push(item)
	}
	return (
		<View style={{ gap: 10 }}>
			<Caps large>{t('Актуальное сегодня')}</Caps>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
				{items.map((item) => (
					<Pressable
						key={item.text}
						onPress={() => {
							haptic.select()
							useRecentSearches.getState().add(item.text)
							openCatalog({ q: item.text })
						}}
						accessibilityRole="button"
						accessibilityLabel={item.text}
						style={{ height: 56, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, paddingLeft: 6, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}
					>
						<CategoryBadge slug={item.slug} size={44} />
						<Text numberOfLines={1} style={{ fontSize: fs.base, fontFamily: fontFamily(600), color: c.ink }}>
							{item.text}
						</Text>
					</Pressable>
				))}
			</ScrollView>
		</View>
	)
}

/** Title of the home feed: «Для Camry 50», or without a car «Новые на витрине» + a nudge to add one. */
export function FeedTitle({ carLabel }: { carLabel?: string }) {
	const c = useColors()
	if (carLabel) return <Caps large>{t('Для {0}', carLabel)}</Caps>
	return (
		<View style={{ gap: 8 }}>
			<Caps large>{t('Новые на витрине')}</Caps>
			<Pressable
				onPress={() => requireSignIn(t('Чтобы сохранить машину в гараж, войдите по номеру телефона.')) && router.push('/garage-add')}
				accessibilityRole="button"
				style={{ minHeight: 44, borderRadius: 14, backgroundColor: c.brandTint, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' }}
			>
				<Text style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(600), color: c.brandInk }}>{t('Добавьте машину — покажем, что подходит именно к ней →')}</Text>
			</Pressable>
		</View>
	)
}

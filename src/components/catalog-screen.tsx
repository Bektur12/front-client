import { useRef, useEffect, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useScrollToTop } from 'expo-router'
import { Button, EmptyState, ProductCard, QueryErrorBanner, Skeleton, SkeletonProductGrid } from '@/components/ui'
import { SearchIcon } from '@/components/icons'
import { CameraV23Icon, CrossIcon, MicV23Icon } from '@/components/buyer-v23'
import { fixed, fontFamily, fs, sectionTitle, useColors } from '@/theme'
import { useVideoViewer } from '@/store/useVideoViewer'
import { resolveUrl } from '@/lib/api'
import { countLabel, formatPartPrice, plural } from '@/lib/format'
import { useSearchParts, useSignedIn } from '@/api/catalog'
import { useCategories } from '@/api/directory'
import { useRequestHints } from '@/api/requests'
import { useCars } from '@/api/garage'
import type { PartCard } from '@/api/types'
import { type CatalogSort, toPartFilters, useCatalogFilters } from '@/store/useCatalogFilters'
import { useSession } from '@/store/useSession'
import { useRecentSearches } from '@/store/useRecentSearches'
import { briefPlace } from '@/lib/shop-place'
import { MarketFilterBanner } from '@/components/market-chips'
import { CategoryBack, CategoryGrid, ContextRow, GroupTitle } from '@/components/catalog-filters'
import { t } from '@/i18n'
import { KEYBOARD_DONE } from '@/components/keyboard-done'
import { requireSignIn } from '@/components/sign-in-prompt'

const SORTS: { value: CatalogSort; label: string }[] = [
	{ value: 'PRICE_ASC', label: t('Дешевле') },
	{ value: 'PRICE_DESC', label: t('Дороже') },
	{ value: 'NEWEST', label: t('Новые') },
]

/**
 * 27 «Поиск запчастей» — the «Запчасти» tab of the buyer and the master: garage car or any brand, categories,
 * infinite grid. With a car — fitting parts first; without one — all parts. A master has no car of their own:
 * «Выберите марку» (the client's), until then all parts are shown.
 */
/** `floatingRoom` — место под «＋» над меню покупателя: полоса «Не нашли?» и низ списка поднимаются над ним. */
export function CatalogScreen({ floatingRoom = 0 }: { floatingRoom?: number } = {}) {
	const c = useColors()
	// Tapping the active tab again scrolls back to the top, as in every app.
	const list = useRef<FlatList<Row>>(null)
	useScrollToTop(list)
	const insets = useSafeAreaInsets()
	const signedIn = useSignedIn()
	const f = useCatalogFilters()
	const cars = useCars(signedIn)
	const categories = useCategories()
	const [text, setText] = useState(f.q)
	const [focused, setFocused] = useState(false)
	// «Не нашли?» над меню — только когда человек пролистал витрину, а не с первой секунды поверх товаров.
	const [showAsk, setShowAsk] = useState(false)
	const recent = useRecentSearches()

	// Debounce typing — the search runs 350 ms after the last key.
	useEffect(() => {
		const timer = setTimeout(() => useCatalogFilters.getState().setQ(text), 350)
		return () => clearTimeout(timer)
	}, [text])

	const carList = signedIn ? (cars.data ?? []) : []
	// A master or СТО has no car of their own — they pick the client's: brand → model.
	const isMaster = useSession((s) => s.role) === 'MASTER'
	const carId = f.carId === undefined ? carList.find((car) => car.isPrimary)?.id ?? null : f.carId
	const partFilters = toPartFilters({ ...f, carId })
	// «Часто ищут» — для машины из гаража с сервера; гостю — самое частое на рынке.
	const hints = useRequestHints(carId ?? undefined, 8, signedIn && focused)
	const popular = hints.data?.length ? hints.data.map((hint) => hint.text) : POPULAR
	const runSearch = (value: string) => {
		setText(value)
		useCatalogFilters.getState().setQ(value)
		recent.add(value)
	}
	/** «Найти запчасть»: с тем, что уже набрали, и машиной; `start` — сразу открыть камеру или запись голоса. */
	const askSellers = (start?: 'camera' | 'voice') =>
		requireSignIn() &&
		router.push({ pathname: '/search-part', params: { text: f.q.trim() || undefined, carId: carId ? String(carId) : undefined, start } })
	const search = useSearchParts(partFilters)
	const pages = search.data?.pages
	const items = pages?.flatMap((page) => page.items) ?? []
	const total = pages?.[0]?.total
	const fitsTotal = pages?.[0]?.fitsTotal
	const appliedCar = pages?.[0]?.appliedCar
	// Grid rows of two; with a car — fitting parts first, then «Остальные запчасти» (the server sorts them so).
	const rows: Row[] = []
	let pending: PartCard[] = []
	const flush = () => {
		if (pending.length) rows.push({ kind: 'parts', parts: pending })
		pending = []
	}
	for (const part of items) {
		if (appliedCar && part.fits === false && !rows.some((row) => row.kind === 'others')) {
			flush()
			rows.push({ kind: 'others' })
		}
		pending.push(part)
		if (pending.length === 2) flush()
	}
	flush()
	const category = (categories.data ?? []).find((item) => item.id === f.categoryId)
	const sort = SORTS.find((s) => s.value === f.sort) ?? SORTS[0]
	const nextSort = SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]

	const header = (
		<View style={{ gap: 14, paddingBottom: 14 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
				<Text style={{ flex: 1, fontSize: fs.h1, fontFamily: fontFamily(700), letterSpacing: -0.26, color: c.ink }}>{t('Запчасти')}</Text>
				<Pressable onPress={() => router.push('/shops')} hitSlop={8}>
					<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('Магазины ›')}</Text>
				</Pressable>
			</View>

			<View
				style={{
					height: 52,
					borderRadius: 14,
					backgroundColor: c.card,
					borderWidth: 2,
					borderColor: c.brand,
					flexDirection: 'row',
					alignItems: 'center',
					gap: 10,
					paddingHorizontal: 12,
				}}
			>
				<SearchIcon size={20} color={c.muted} strokeWidth={2.4} />
				<TextInput inputAccessoryViewID={KEYBOARD_DONE}
					value={text}
					onChangeText={setText}
					placeholder={t('Колодки, фильтр…')}
					placeholderTextColor={c.fillInk}
					returnKeyType="search"
					onFocus={() => setFocused(true)}
					onBlur={() => {
						// Подсказки прячем чуть позже: в браузере поле теряет фокус раньше, чем срабатывает нажатие на пилюлю.
						setTimeout(() => setFocused(false), 200)
						// Left the field with something found — worth offering again next time.
						if (text.trim() && total) recent.add(text)
					}}
					onSubmitEditing={() => {
						useCatalogFilters.getState().setQ(text)
						recent.add(text)
					}}
					style={{ flex: 1, minWidth: 0, fontSize: fs.lg, fontFamily: fontFamily(400), color: c.ink, padding: 0 }}
				/>
				{text ? (
					<Pressable onPress={() => runSearch('')} hitSlop={8} accessibilityLabel={t('Очистить')} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' }}>
						<CrossIcon size={14} color={c.muted} />
					</Pressable>
				) : (
					// Показать или сказать проще, чем написать: фото или голос сразу уходят продавцам в «Найти запчасть».
					<View style={{ flexDirection: 'row', gap: 4, marginRight: -4 }}>
						<Pressable onPress={() => askSellers('camera')} hitSlop={4} accessibilityLabel={t('Найти по фото')} style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
							<CameraV23Icon size={22} color={c.brandStrong} />
						</Pressable>
						<Pressable onPress={() => askSellers('voice')} hitSlop={4} accessibilityLabel={t('Сказать голосом')} style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
							<MicV23Icon size={22} color={c.brandStrong} />
						</Pressable>
					</View>
				)}
			</View>

			{focused && !text ? (
				<View style={{ gap: 14 }}>
					{recent.items.length ? (
						<View style={{ gap: 8 }}>
							<View style={{ flexDirection: 'row', alignItems: 'center' }}>
								<Text style={{ flex: 1, ...sectionTitle, color: c.inkSecondary }}>{t('Недавно искали')}</Text>
								<Text onPress={recent.clear} style={{ fontSize: fs.md, fontFamily: fontFamily(600), color: c.brandStrong }}>{t('Очистить')}</Text>
							</View>
							<SearchChips items={recent.items} onPick={runSearch} onLongPress={recent.remove} />
						</View>
					) : null}
					<View style={{ gap: 8 }}>
						<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{t('Часто ищут')}</Text>
						<SearchChips items={popular.filter((item) => !recent.items.includes(item))} onPick={runSearch} />
					</View>
				</View>
			) : null}

			{/* «Для какой машины» и «на каком рынке» — две кнопки, выбор в шторке снизу. */}
			<ContextRow
				car={{ cars: carList, carId, brand: f.brand, modelLabel: f.modelLabel, isMaster, pickCar: f.pickCar, pickBrand: (brand) => f.pickBrand(brand) }}
				marketId={f.marketId}
				onMarket={f.setMarket}
			/>
			<MarketFilterBanner marketId={f.marketId} />

			{/* Ничего не ищут — сетка категорий; выбрали категорию — она одной строкой «‹ Тормоза». */}
			{category ? (
				<CategoryBack category={category} onBack={() => f.setCategory(null)} />
			) : !f.q.trim() ? (
				<>
					<GroupTitle>{t('Категории')}</GroupTitle>
					<CategoryGrid categories={categories.data ?? []} loading={categories.isLoading} onPick={f.setCategory} />
				</>
			) : null}

			<QueryErrorBanner error={search.error} onRetry={() => search.refetch()} offlineText={t('Нет сети. Покажем запчасти, когда появится')} />

			{/* К машине на витрине ничего — не «0 подходят», а выход: спросить продавцов, у них часто есть на складе. */}
			{appliedCar && fitsTotal === 0 ? (
				<View style={{ borderRadius: 18, padding: 16, gap: 12, backgroundColor: c.brandTint }}>
					<View style={{ gap: 4 }}>
						<Text style={{ fontSize: fs.lg, fontFamily: fontFamily(800), color: c.brandInk }}>{t('К {0} пока нет на витрине', appliedCar.displayName)}</Text>
						<Text style={{ fontSize: fs.sm, lineHeight: 20, fontFamily: fontFamily(500), color: c.brandInk }}>
							{t('Продавцы держат много запчастей на складе. Спросите — ответят с ценой')}
						</Text>
					</View>
					{/* стандартная кнопка: Pressable со стилем-функцией на iPhone терял фон — белый текст пропадал */}
					<Button label={t('Спросить продавцов')} onPress={() => askSellers()} />
				</View>
			) : null}

			<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
				{total === undefined && search.isLoading ? (
					<View style={{ flex: 1 }}>
						<Skeleton width={150} height={16} />
					</View>
				) : (
				<Text numberOfLines={1} style={{ flex: 1, fontSize: fs.base, fontFamily: fontFamily(400), color: c.muted }}>
					{total === undefined ? (
						' '
					) : (
						<>
							{appliedCar && fitsTotal ? (
								<>
									<Text style={{ fontFamily: fontFamily(700), color: c.ink }}>
										{fitsTotal} {plural(fitsTotal, [t('подходит'), t('подходят'), t('подходят')])}
									</Text>
									{t(' к {0}', appliedCar.displayName)}
								</>
							) : (
								<Text style={{ fontFamily: fontFamily(700), color: c.ink }}>
									{countLabel(total, [t('запчасть'), t('запчасти'), t('запчастей')])}
								</Text>
							)}
						</>
					)}
				</Text>
				)}
				<Pressable onPress={() => f.setSort(nextSort.value)}>
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}>{sort.label} ▾</Text>
				</Pressable>
			</View>
		</View>
	)

	return (
		<View style={{ flex: 1, backgroundColor: c.surface }}>
			<FlatList automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
				ref={list}
				data={rows}
				keyExtractor={(row) => (row.kind === 'others' ? 'others' : row.parts.map((part) => part.id).join('-'))}
				ListHeaderComponent={header}
				contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 90 + floatingRoom, gap: 20 }}
				showsVerticalScrollIndicator={false}
				scrollEventThrottle={100}
				onScroll={(e) => {
					const scrolled = e.nativeEvent.contentOffset.y > 500
					if (scrolled !== showAsk) setShowAsk(scrolled)
				}}
				onEndReached={() => search.hasNextPage && !search.isFetchingNextPage && search.fetchNextPage()}
				renderItem={({ item: row }) =>
					row.kind === 'others' ? (
						<Text style={{ paddingTop: 8, ...sectionTitle, color: c.inkSecondary }}>{t('Остальные запчасти')}</Text>
					) : (
						<View style={{ flexDirection: 'row', gap: 12 }}>
							{row.parts.map((part) => (
								<View key={part.id} style={{ flex: 1 }}>
									<PartTile part={part} />
								</View>
							))}
							{row.parts.length === 1 ? <View style={{ flex: 1 }} /> : null}
						</View>
					)
				}
				ListFooterComponent={search.isFetchingNextPage ? <SkeletonProductGrid rows={1} /> : undefined}
				ListEmptyComponent={
					search.isSuccess ? (
						<EmptyState
							title={
								category
									? appliedCar
										? t('{0} для {1} пока нет на витрине', category.name, appliedCar.displayName)
										: t('В «{0}» пока пусто', category.name)
									: f.q.trim()
										? t('«{0}» пока нет на витрине', f.q.trim())
										: t('Ничего не нашли')
							}
							icon={SearchIcon}
							hint={t('Спросите у продавцов рынка — кто-то наверняка держит её не на витрине')}
							secondary={
								f.categoryId != null || f.brand
									? {
											label: t('Сбросить фильтры'),
											onPress: () => {
												f.setCategory(null)
												if (f.brand) f.pickBrand(null)
											},
										}
									: undefined
							}
							action={{
								label: t('Спросить у продавцов'),
								onPress: () => askSellers(),
							}}
						/>
					) : search.isLoading ? (
						<SkeletonProductGrid rows={3} />
					) : undefined
				}
			/>

			{showAsk && items.length ? (
			<Pressable
				onPress={() => askSellers()}
				style={{
					position: 'absolute',
					left: 16,
					right: 16,
					bottom: 12 + floatingRoom,
					height: 52,
					borderRadius: 14,
					// dark pill in both themes: `ink` is near-white in the dark theme, and the white label vanished on it
					backgroundColor: c.inverse,
					paddingHorizontal: 16,
					flexDirection: 'row',
					alignItems: 'center',
					gap: 12,
					shadowColor: fixed.shadow,
					shadowOpacity: 0.25,
					shadowOffset: { width: 0, height: 8 },
					shadowRadius: 20,
					elevation: 8,
				}}
			>
				<Text numberOfLines={1} style={{ flex: 1, fontSize: fs.md, fontFamily: fontFamily(500), color: fixed.white }}>{t('Не нашли нужное?')}</Text>
				<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: fixed.linkOnDark }}>{t('Спросить →')}</Text>
			</Pressable>
			) : null}
		</View>
	)
}

type Row = { kind: 'parts'; parts: PartCard[] } | { kind: 'others' }

/** «Часто ищут», пока сервер не ответил или гость без гаража. */
const POPULAR = [t('Колодки'), t('Масляный фильтр'), t('Аккумулятор'), t('Амортизаторы'), t('Свечи'), t('Фара'), t('Моторное масло'), t('Шины')]

/** Пилюли запросов: нажал — сразу ищем. */
function SearchChips({ items, onPick, onLongPress }: { items: string[]; onPick: (item: string) => void; onLongPress?: (item: string) => void }) {
	const c = useColors()
	return (
		<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
			{items.map((item) => (
				<Pressable
					key={item}
					onPress={() => onPick(item)}
					onLongPress={onLongPress ? () => onLongPress(item) : undefined}
					style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }}
				>
					<Text numberOfLines={1} style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.ink }}>{item}</Text>
				</Pressable>
			))}
		</View>
	)
}

/** A part in a grid — the catalog and «Похожие» on the part card. A video part opens the feed on it. */
export function PartTile({ part }: { part: PartCard }) {
	return (
		<ProductCard
			price={formatPartPrice(part.price)}
			title={part.title}
			fits={part.fits === true}
			location={briefPlace(part.shop)}
			shopName={part.shop.name}
			photoUrl={resolveUrl(part.mainPhoto?.thumbUrl ?? part.mainPhoto?.url ?? part.video?.posterUrl)}
			shopAvatarUrl={resolveUrl(part.shop.avatarUrl)}
			dimmed={part.stockStatus === 'OUT_OF_STOCK'}
			favorite={part.isFavorite}
			videoSec={part.video?.durationSec}
			onPress={() => {
				// A part with a video opens the video feed on it — swiping there shows only videos.
				if (part.video) {
					useVideoViewer.getState().openVideo(part.id)
					router.push('/videos')
				} else router.push({ pathname: '/part', params: { id: String(part.id) } })
			}}
		/>
	)
}

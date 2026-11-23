import { useEffect, useState } from 'react'
import { Linking, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from 'react-native'
import { onNearEnd } from '@/lib/scroll'
import { Image } from '@/components/ui/image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { LocationCard, QueryErrorBanner, Skeleton, SkeletonProductGrid, SkeletonRepeat, MoreButton } from '@/components/ui'
import { BrandLogo } from '@/components/ui/brand'
import { ChatIcon, ChevronLeftIcon, HeartIcon, MapPinIcon, PhoneIcon, SearchIcon, ShareIcon, WhatsAppIcon } from '@/components/icons'
import { openWhatsApp } from '@/lib/whatsapp'
import { fixed, fontFamily, fs, sectionTitle, useColors } from '@/theme'
import { resolveUrl } from '@/lib/api'
import { formatDay, formatSide, plural } from '@/lib/format'
import { formatOpenNow, formatSchedule } from '@/lib/hours'
import { flattenPages } from '@/api/pagination'
import { usePublicShop, useShop, useShopParts, useShopReviews, useSignedIn, useToggleShopFavorite } from '@/api/catalog'
import { useOpenChat } from '@/api/chats'
import { ComplainLink, ComplaintSheet, type ComplaintTarget } from '@/components/complaint-sheet'
import { open2gis, openShopRoute } from '@/lib/shop-place'
import { PartTile } from '@/components/catalog-screen'
import { t } from '@/i18n'
import { KEYBOARD_DONE } from '@/components/keyboard-done'
import { openSignIn } from '@/components/sign-in-prompt'
import { goBack } from '@/lib/navigation'

/** Filled rating stars — gold, the empty ones stay grey. */
const STAR = fixed.star

type Tab = 'parts' | 'reviews'
/** More parts than this — the profile gets «Поиск по товарам магазина». */
const SEARCH_FROM = 8

/** 30 — shop profile for buyers. `id`, or `publicId` from a share link /s/{publicId}. */
export default function SellerProfileForBuyerScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const { width } = useWindowDimensions()
	const params = useLocalSearchParams<{ id?: string; publicId?: string }>()
	const signedIn = useSignedIn()
	const byId = useShop(Number(params.id) || 0)
	const byPublicId = usePublicShop(params.publicId ?? '')
	const query = params.publicId ? byPublicId : byId
	const shop = query.data
	const shopId = shop?.id ?? 0
	const loading = !shop && query.isLoading

	const [tab, setTab] = useState<Tab>('parts')
	const [complaint, setComplaint] = useState<ComplaintTarget | null>(null)
	const [categoryId, setCategoryId] = useState<number | null>(null)
	// Search within the shop — the request goes out once typing pauses, not on every letter.
	const [typed, setTyped] = useState('')
	const [q, setQ] = useState('')
	useEffect(() => {
		const timer = setTimeout(() => setQ(typed.trim()), 350)
		return () => clearTimeout(timer)
	}, [typed])
	const parts = useShopParts(shopId, { ...(categoryId ? { categoryId } : {}), ...(q ? { q } : {}) })
	const reviews = useShopReviews(shopId, tab === 'reviews')
	const favorite = useToggleShopFavorite(shopId)
	const openChat = useOpenChat()

	const banner = shop?.photos[0]
	const partItems = flattenPages(parts.data)
	// Only reviews with something said (tags, the seller's reply) — a bare rating is in the ★ average above.
	const reviewItems = flattenPages(reviews.data).filter((review) => review.tags.length > 0 || review.reply)
	const brands = shop?.brands ?? []
	const counts = shop?.counts
	const openNow = shop ? formatOpenNow(shop.open) : null
	const partCategories = shop?.partCategories ?? []

	const route = () => shop && openShopRoute(shop)
	const write = () =>
		shop &&
		(signedIn
			? openChat.mutate({ shopId: shop.id }, { onSuccess: (chat) => router.push({ pathname: '/chat', params: { chatId: String(chat.id) } }) })
			: openSignIn())

	const roundButton = { width: 40, height: 40, borderRadius: 20, backgroundColor: c.floating, alignItems: 'center', justifyContent: 'center' } as const

	return (
		<View style={{ flex: 1, backgroundColor: c.surface }}>
			<ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				scrollEventThrottle={200}
				onScroll={onNearEnd(() => {
					const list = tab === 'parts' ? parts : reviews
					if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage()
				})}
			>
				<View>
					{/* One banner — the box's first photo; no gallery. */}
					{banner ? (
						<Image source={{ uri: resolveUrl(banner.url) }} style={{ width, height: 210 }} contentFit="cover" />
					) : loading ? (
						<Skeleton height={210} radius={0} />
					) : (
						<View style={{ width: '100%', height: 210, backgroundColor: c.fill }} />
					)}
					<View
						style={{
							position: 'absolute',
							left: 16,
							right: 16,
							top: insets.top + 9,
							flexDirection: 'row',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}
					>
						<Pressable accessibilityRole="button" accessibilityLabel={t('Назад')} onPress={() => goBack()} style={roundButton}>
							<ChevronLeftIcon size={24} color={c.ink} />
						</Pressable>
						<View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
							{signedIn && shop ? (
								<Pressable accessibilityRole="button" accessibilityLabel={shop.isFavorite ? t('Убрать из избранного') : t('В избранное')} onPress={() => favorite.mutate(!shop.isFavorite)} style={roundButton}>
									<HeartIcon size={20} color={shop.isFavorite ? c.danger : c.ink} filled={shop.isFavorite} />
								</Pressable>
							) : null}
							{shop ? (
								<Pressable accessibilityRole="button" accessibilityLabel={t('Поделиться')}
									onPress={() => Share.share({ message: `${shop.name}\nhttps://kudaibergen.kg/s/${shop.publicId}` })}
									style={roundButton}
								>
									<ShareIcon size={20} color={c.ink} />
								</Pressable>
							) : null}
						</View>
					</View>
				</View>

				<View style={{ marginTop: -44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
					{shop?.avatarUrl ? (
						<Image
							source={{ uri: resolveUrl(shop.avatarUrl) }}
							style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 4, borderColor: c.surface }}
						/>
					) : loading ? (
						<View style={{ borderRadius: 48, borderWidth: 4, borderColor: c.surface }}>
							<Skeleton width={80} height={80} radius={40} />
						</View>
					) : (
						<View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.fill, borderWidth: 4, borderColor: c.surface }} />
					)}
				</View>

				<View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 14 }}>
					<QueryErrorBanner error={query.error} onRetry={() => query.refetch()} />

					{loading ? (
						<View style={{ gap: 10 }}>
							<Skeleton width="60%" height={24} />
							<Skeleton width="40%" height={15} />
						</View>
					) : (
					<View style={{ gap: 2 }}>
						<Text style={{ fontSize: fs.h3, fontFamily: fontFamily(800), color: c.ink }}>{shop?.name ?? ' '}</Text>
						<Text style={{ fontSize: fs.md, fontFamily: fontFamily(400), color: c.muted }}>
							{shop
								? shop.reviewsCount
									? <><Text style={{ color: STAR }}>★</Text>{` ${shop.rating.toFixed(1)} · ${shop.reviewsCount} ${plural(shop.reviewsCount, [t('оценка'), t('оценки'), t('оценок')])}`}</>
									: null
								: ' '}
						</Text>
					</View>
					)}

					{shop && openNow ? (
						<View style={{ gap: 2 }}>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
								<View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: openNow.open ? c.success : c.danger }} />
								<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: openNow.open ? c.success : c.danger }}>{openNow.label}</Text>
							</View>
							<Text style={{ fontSize: fs.md, fontFamily: fontFamily(400), color: c.muted, paddingLeft: 17 }}>{formatSchedule(shop.open)}</Text>
						</View>
					) : null}

					{loading ? (
						<Skeleton height={128} radius={16} />
					) : (
					<View style={{ borderRadius: 16, backgroundColor: c.card, padding: 12, gap: 14 }}>
						{/* On the market — row and box; a shop / centre elsewhere — its address. */}
						{shop && !shop.location ? (
							<Text style={{ fontSize: fs.lg, lineHeight: 23, fontFamily: fontFamily(600), color: c.ink }}>{shop.address}</Text>
						) : (
							<LocationCard rowLabel={shop?.location?.rowCode ?? ' '} boxLabel={shop?.location ? String(shop.location.number) : ' '} />
						)}
						<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
							<Text style={{ fontSize: fs.md, fontFamily: fontFamily(400), color: c.inkSecondary }}>
								{shop?.location ? t('{0} сторона', formatSide(shop.location.side)).replace(/^./, (ch) => ch.toUpperCase()) : shop ? t('Магазин') : ' '}
							</Text>
							<Pressable
								// The place in 2GIS — a market box shows the market itself.
								onPress={() => shop && open2gis({ lat: shop.lat, lng: shop.lng, address: shop.address ?? t('Рынок Кудайберген, Бишкек') })}
								style={{ height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: c.brandTint, flexDirection: 'row', alignItems: 'center', gap: 6 }}
							>
								<MapPinIcon size={16} color={c.brandStrong} />
								<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('2ГИС')}</Text>
							</Pressable>
						</View>
					</View>
					)}

					{brands.length ? (
						<View style={{ gap: 8 }}>
							<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{t('Продаёт для марок')}</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
								<View style={{ width: 8 }} />
								{brands.map((brand) => (
									<View
										key={brand.id}
										style={{ height: 44, paddingLeft: 6, paddingRight: 14, borderRadius: 22, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 8 }}
									>
										<BrandLogo brand={brand} size={32} />
										<Text style={{ fontSize: fs.base, fontFamily: fontFamily(600), color: c.ink }}>{brand.name}</Text>
									</View>
								))}
								<View style={{ width: 8 }} />
							</ScrollView>
						</View>
					) : null}

					{openChat.error ? (
						<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.danger }}>{openChat.error.message}</Text>
					) : null}

					<View style={{ flexDirection: 'row', gap: 20 }}>
						{(
							[
								{ value: 'parts', label: t('Запчасти {0}', counts?.parts ?? '') },
								{ value: 'reviews', label: t('Отзывы') },
							] as const
						).map((item) => (
							<Pressable
								key={item.value}
								onPress={() => setTab(item.value)}
								style={{
									paddingBottom: 6,
									borderBottomWidth: 2,
									borderBottomColor: tab === item.value ? c.brand : 'transparent',
								}}
							>
								<Text
									style={{
										fontSize: fs.base,
										fontFamily: fontFamily(tab === item.value ? 700 : 600),
										color: tab === item.value ? c.ink : c.muted,
									}}
								>
									{item.label.trim()}
								</Text>
							</Pressable>
						))}
					</View>

					{/* Only where there is a lot to look through — a small shop needs no search field. */}
					{tab === 'parts' && (counts?.parts ?? 0) > SEARCH_FROM ? (
						<View style={{ height: 46, borderRadius: 12, backgroundColor: c.card, borderWidth: 1.5, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
							<SearchIcon size={18} color={c.muted} />
							<TextInput
								inputAccessoryViewID={KEYBOARD_DONE}
								value={typed}
								onChangeText={setTyped}
								placeholder={t('Поиск по товарам магазина')}
								placeholderTextColor={c.muted}
								returnKeyType="search"
								style={{ flex: 1, fontSize: fs.base, fontFamily: fontFamily(400), color: c.ink, padding: 0 }}
							/>
						</View>
					) : null}

					{tab === 'parts' && partCategories.length > 1 ? (
						<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
							<View style={{ width: 8 }} />
							{[{ id: null, name: t('Все'), count: counts?.parts ?? 0 }, ...partCategories].map((category) => {
								const selected = category.id === categoryId
								return (
									<Pressable
										key={category.id ?? 'all'}
										onPress={() => setCategoryId(category.id)}
										style={{ height: 38, paddingHorizontal: 14, borderRadius: 19, backgroundColor: selected ? c.brand : c.card, flexDirection: 'row', alignItems: 'center', gap: 6 }}
									>
										<Text style={{ fontSize: fs.base, fontFamily: fontFamily(selected ? 700 : 600), color: selected ? fixed.white : c.ink }}>{category.name}</Text>
										<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(600), color: selected ? fixed.white : c.muted }}>{category.count}</Text>
									</Pressable>
								)
							})}
							<View style={{ width: 8 }} />
						</ScrollView>
					) : null}

					{tab === 'parts' ? (
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 20, paddingBottom: 24 }}>
							{partItems.map((part) => (
								// the catalog's tile: a video part shows its poster with ▶ and opens the feed
								<View key={part.id} style={{ width: (width - 32 - 10) / 2 }}>
									<PartTile part={part} />
								</View>
							))}
							{parts.isFetchingNextPage ? (
								<View style={{ width: '100%' }}>
									<SkeletonProductGrid rows={1} gap={10} />
								</View>
							) : null}
							{loading || parts.isLoading ? (
								<View style={{ width: '100%' }}>
									<SkeletonProductGrid rows={2} gap={10} />
								</View>
							) : null}
							{parts.isSuccess && partItems.length === 0 ? (
								<Text style={{ fontSize: fs.base, fontFamily: fontFamily(400), color: c.muted }}>{q || categoryId ? t('Ничего не нашли — попробуйте другое слово') : t('Запчасти ещё не выложены')}</Text>
							) : null}
						</View>
					) : null}

					{tab === 'reviews' ? (
						<View style={{ gap: 10, paddingBottom: 24 }}>
							{reviews.isLoading ? (
								<SkeletonRepeat count={3} gap={10}>
									<View style={{ borderRadius: 14, backgroundColor: c.card, padding: 12, gap: 10 }}>
										<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
											<Skeleton width={90} height={16} />
											<Skeleton width={60} height={13} />
										</View>
										<Skeleton width="75%" height={14} />
									</View>
								</SkeletonRepeat>
							) : null}
							{reviewItems.map((review) => (
								<Pressable
									key={review.id}
									onLongPress={() => setComplaint({ type: 'REVIEW', targetId: review.id })}
									style={{ borderRadius: 14, backgroundColor: c.card, padding: 12, gap: 6 }}
								>
									<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
										<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: STAR }}>
											{'★'.repeat(review.stars)}
											<Text style={{ color: c.dashed }}>{'★'.repeat(5 - review.stars)}</Text>
										</Text>
										<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
											<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(400), color: c.muted }}>{formatDay(review.createdAt)}</Text>
											<MoreButton label={t('Пожаловаться на отзыв')} onPress={() => setComplaint({ type: 'REVIEW', targetId: review.id })} />
										</View>
									</View>
									<Text style={{ fontSize: fs.md, fontFamily: fontFamily(600), color: c.inkSecondary }}>
										{review.buyerName ?? t('Покупатель')}
										{review.tags.length ? ` · ${review.tags.map((t) => t.label).join(', ')}` : ''}
									</Text>
									{review.reply ? (
										<Text style={{ fontSize: fs.md, fontFamily: fontFamily(400), color: c.muted }}>{t('Ответ продавца: {0}', review.reply)}</Text>
									) : null}
								</Pressable>
							))}
							{reviews.isFetchingNextPage ? <Skeleton height={64} radius={14} /> : null}
						</View>
					) : null}
				</View>
				{shop ? <ComplainLink onPress={() => setComplaint({ type: 'SHOP', targetId: shop.id })} label={t('Пожаловаться на магазин')} /> : null}
			</ScrollView>
			{/* Pinned under the thumb: scrolling through parts and reviews doesn't take «Написать» away. */}
			<View
				style={{
					paddingHorizontal: 16,
					paddingTop: 12,
					paddingBottom: insets.bottom + 12,
					borderTopWidth: 1,
					borderTopColor: c.hairline,
					backgroundColor: c.surface,
					flexDirection: 'row',
					gap: 8,
				}}
			>
				<Pressable
					onPress={route}
					accessibilityRole="button"
					style={{ flex: 1, height: 52, paddingHorizontal: 10, borderRadius: 14, backgroundColor: c.fill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
				>
					<MapPinIcon size={20} color={c.ink} />
					<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, fontSize: fs.lg, fontFamily: fontFamily(700), color: c.ink }}>{shop && !shop.location ? t('2ГИС') : t('Маршрут')}</Text>
				</Pressable>
				<Pressable
					onPress={write}
					disabled={!shop || openChat.isPending}
					accessibilityRole="button"
					style={{ flex: 1.6, height: 52, paddingHorizontal: 10, borderRadius: 14, backgroundColor: c.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: openChat.isPending ? 0.6 : 1 }}
				>
					<ChatIcon size={20} color={fixed.white} />
					<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, fontSize: fs.lg, fontFamily: fontFamily(700), color: fixed.white }}>{t('Написать')}</Text>
				</Pressable>
				{/* The phone, then WhatsApp at the edge — only when the shop made the number visible (or after a chat). */}
				{shop?.phone ? (
					<Pressable accessibilityRole="button" accessibilityLabel={t('Позвонить')}
						onPress={() => Linking.openURL(`tel:${shop.phone}`)}
						style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' }}
					>
						<PhoneIcon size={20} color={c.ink} />
					</Pressable>
				) : null}
				{shop?.phone ? (
					<Pressable accessibilityRole="button" accessibilityLabel={t('Написать в WhatsApp')}
						onPress={() => shop.phone && openWhatsApp(shop.phone)}
						style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: fixed.whatsapp, alignItems: 'center', justifyContent: 'center' }}
					>
						<WhatsAppIcon size={24} color={fixed.white} />
					</Pressable>
				) : null}
			</View>
			<ComplaintSheet target={complaint} onClose={() => setComplaint(null)} />
		</View>
	)
}

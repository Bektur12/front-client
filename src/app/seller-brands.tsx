import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { QueryErrorBanner, ScreenHeader, toast } from '@/components/ui'
import { BrandLogo } from '@/components/ui/brand'
import { CheckIcon, SearchIcon } from '@/components/icons'
import { fixed, fontFamily, fs, sectionTitle, useColors } from '@/theme'
import { plural } from '@/lib/format'
import { useBrands, useCategories } from '@/api/directory'
import { useMyShop, useSetShopBrands, useSetShopCategories } from '@/api/shop'
import { CategoryChips } from '@/components/category-chips'
import { t } from '@/i18n'
import { KEYBOARD_DONE } from '@/components/keyboard-done'
import { goBack } from '@/lib/navigation'

/** 23 «Марки, которые продаю» — requests come only for these brands. */
export default function SellerBrandsScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const shop = useMyShop()
	const [q, setQ] = useState('')
	const all = useBrands(q.trim() ? { q: q.trim() } : {})
	const save = useSetShopBrands()
	const [picked, setPicked] = useState<number[] | null>(null)
	const selected = picked ?? shop.data?.brands.map((b) => b.id) ?? []

	const toggle = (id: number) => setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

	// что продаёт: ходовая, оптика… — по марке и категории покупатель ищет на карте
	const categories = useCategories()
	const saveCategories = useSetShopCategories()
	const [pickedCategories, setPickedCategories] = useState<number[] | null>(null)
	const selectedCategories = pickedCategories ?? shop.data?.categories.map((category) => category.id) ?? []
	const toggleCategory = (id: number) =>
		setPickedCategories(selectedCategories.includes(id) ? selectedCategories.filter((x) => x !== id) : [...selectedCategories, id])
	const saving = save.isPending || saveCategories.isPending
	const submit = () =>
		save.mutate(selected, {
			onSuccess: () => {
				const done = () => (toast(t('Сохранено')), goBack())
				// категории — только если меняли (пустой список сервер не примет)
				if (pickedCategories && pickedCategories.length) saveCategories.mutate(pickedCategories, { onSuccess: done })
				else done()
			},
		})

	const searching = q.trim().length > 0
	const popularBrands = searching ? [] : (all.data ?? []).filter((b) => b.popular)
	const otherBrands = searching ? (all.data ?? []) : (all.data ?? []).filter((b) => !b.popular)

	return (
		<View style={{ flex: 1, backgroundColor: c.surface }}>
			<ScreenHeader inset title={t('Марки, которые продаю')} />

			<ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
				<View
					style={{
						height: 48,
						borderRadius: 12,
						backgroundColor: c.card,
						borderWidth: 2,
						borderColor: c.border,
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

				<QueryErrorBanner error={shop.error ?? all.error ?? save.error ?? saveCategories.error ?? categories.error} onRetry={() => all.refetch()} />

				{!searching && categories.data?.length ? (
					<View style={{ gap: 8, paddingBottom: 4 }}>
						<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{t('Что продаёте')}</Text>
						<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.muted }}>{t('Можно несколько — по ним вас найдут на карте')}</Text>
						<CategoryChips categories={categories.data} picked={selectedCategories} onToggle={toggleCategory} />
					</View>
				) : null}


				<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
					<Text style={{ ...sectionTitle, color: c.inkSecondary }}>
						{searching ? t('Найдено') : t('Популярные')}
					</Text>
					<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: c.brandStrong }}>Выбрано {selected.length}</Text>
				</View>

				<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
					{popularBrands.map((brand) => {
						const active = selected.includes(brand.id)
						return (
							<Pressable
								key={brand.id}
								onPress={() => toggle(brand.id)}
								style={{
									// Four per row: (358 − 3 × 8) / 4.
									width: 83.5,
									height: 96,
									borderRadius: 14,
									backgroundColor: active ? c.brandTint : c.card,
									borderWidth: 2,
									borderColor: active ? c.brand : 'transparent',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 8,
								}}
							>
								<View>
									<BrandLogo brand={brand} size={40} />
									{active ? (
										<View
											style={{
												position: 'absolute',
												right: -6,
												top: -6,
												width: 20,
												height: 20,
												borderRadius: 10,
												backgroundColor: c.brand,
												alignItems: 'center',
												justifyContent: 'center',
											}}
										>
											<CheckIcon size={13} color={fixed.white} strokeWidth={3} />
										</View>
									) : null}
								</View>
								<Text
									style={{ fontSize: fs.xs, fontFamily: fontFamily(active ? 700 : 600), color: active ? c.brandStrong : c.ink }}
								>
									{brand.shortName}
								</Text>
							</Pressable>
						)
					})}
				</View>

				{!searching ? (
					<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{t('Все марки А–Я')}</Text>
				) : null}

				<View style={{ borderRadius: 16, backgroundColor: c.card, overflow: 'hidden' }}>
					{otherBrands.map((brand, i) => {
						const active = selected.includes(brand.id)
						return (
							<Pressable
								key={brand.id}
								onPress={() => toggle(brand.id)}
								style={{
									height: 56,
									paddingHorizontal: 16,
									flexDirection: 'row',
									alignItems: 'center',
									gap: 12,
									borderBottomWidth: i === otherBrands.length - 1 ? 0 : 2,
									borderBottomColor: c.surface,
								}}
							>
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
									{active ? <CheckIcon size={14} color={fixed.white} strokeWidth={3} /> : null}
								</View>
							</Pressable>
						)
					})}
				</View>
			</ScrollView>

			<View
				style={{
					paddingHorizontal: 16,
					paddingTop: 12,
					paddingBottom: insets.bottom + 12,
					borderTopWidth: 1,
					borderTopColor: c.hairline,
					backgroundColor: c.surface,
				}}
			>
				<Pressable
					disabled={selected.length === 0 || saving}
					onPress={submit}
					style={{
						height: 56,
						borderRadius: 14,
						backgroundColor: c.brand,
						alignItems: 'center',
						justifyContent: 'center',
						opacity: selected.length === 0 ? 0.4 : 1,
					}}
				>
					{saving ? (
						<ActivityIndicator color={fixed.white} />
					) : (
						<Text style={{ fontSize: fs.xl, fontFamily: fontFamily(700), color: fixed.white }}>
							Сохранить · {selected.length} {plural(selected.length, [t('марка'), t('марки'), t('марок')])}
						</Text>
					)}
				</Pressable>
			</View>
		</View>
	)
}

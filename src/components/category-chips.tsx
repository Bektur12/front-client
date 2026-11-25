import { Pressable, ScrollView, Text, View } from 'react-native'
import { CheckIcon } from '@/components/icons'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import type { Category } from '@/api/types'

/**
 * Категории запчастей пилюлями: «Ходовая», «Оптика», «Двигатель»…
 * Продавец отмечает, что продаёт (несколько, переносом строк); на карте — одна, лентой поверх карты.
 */
export function CategoryChips({
	categories,
	picked,
	onToggle,
	scroll = false,
}: {
	categories: Category[]
	picked: number[]
	onToggle: (id: number) => void
	/** Одной лентой с прокруткой (над картой), иначе — с переносом строк (формы). */
	scroll?: boolean
}) {
	const c = useColors()
	const chips = categories.map((category) => {
		const active = picked.includes(category.id)
		return (
			<Pressable
				key={category.id}
				accessibilityRole="checkbox"
				accessibilityState={{ checked: active }}
				onPress={() => onToggle(category.id)}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: 6,
					height: scroll ? 34 : 40,
					paddingHorizontal: 14,
					borderRadius: 20,
					backgroundColor: active ? c.brand : c.card,
					borderWidth: scroll ? 0 : 2,
					borderColor: active ? c.brand : c.border,
					...(scroll
						? { shadowColor: fixed.shadow, shadowOpacity: 0.12, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8, elevation: 3 }
						: {}),
				}}
			>
				{active && !scroll ? <CheckIcon size={13} color={fixed.white} strokeWidth={3} /> : null}
				<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: active ? fixed.white : c.ink }}>{category.name}</Text>
			</Pressable>
		)
	})
	if (scroll) {
		return (
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }} keyboardShouldPersistTaps="handled">
				{chips}
			</ScrollView>
		)
	}
	return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>
}

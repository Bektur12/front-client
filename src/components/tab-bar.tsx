import { forwardRef, type ComponentType, type Ref } from 'react'
import { Pressable, Text, View, type HostInstance, type PressableProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import type { IconProps } from '@/components/icons'

/**
 * Нижнее меню из макета: контент 72px + верхняя граница 2px + отступ 8px сверху. Отступ под системные кнопки
 * (home indicator iPhone, «назад / домой» Android) добавляется к высоте, а не съедает её.
 * Как в Mashina.kg: белое меню без рамки; активная вкладка — чёрная иконка и подпись weight 700, остальные серо-голубые.
 */
export function TabBarContainer({ children }: { children: React.ReactNode }) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	return (
		<View
			style={{
				height: 72 + insets.bottom,
				paddingTop: 8,
				paddingHorizontal: 4,
				paddingBottom: insets.bottom,
				backgroundColor: c.surface,
				flexDirection: 'row',
			}}
		>
			{children}
		</View>
	)
}

interface TabButtonProps extends PressableProps {
	isFocused?: boolean
	icon: ComponentType<IconProps>
	label: string
	badge?: number
}

export const TabButton = forwardRef(function TabButton(
	{ isFocused, icon: Icon, label, badge, ...props }: TabButtonProps,
	ref: Ref<HostInstance>,
) {
	const c = useColors()
	const color = isFocused ? c.ink : c.fillInk

	return (
		<Pressable ref={ref} {...props} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
			<View
				style={{
					width: 56,
					height: 30,
					borderRadius: 15,
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<Icon size={24} color={color} strokeWidth={isFocused ? 2.2 : 1.9} />
				{badge ? (
					<View
						style={{
							position: 'absolute',
							top: -3,
							right: 6,
							minWidth: 18,
							height: 18,
							paddingHorizontal: 5,
							borderRadius: 9,
							backgroundColor: c.danger,
							borderWidth: 2,
							borderColor: c.surface,
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Text style={{ fontSize: fs.xxs, fontFamily: fontFamily(700), color: fixed.white }}>{badge}</Text>
					</View>
				) : null}
			</View>
			<Text
				style={{
					fontSize: fs.xs,
					fontFamily: fontFamily(isFocused ? 700 : 600),
					color,
				}}
			>
				{label}
			</Text>
		</Pressable>
	)
})

/**
 * «＋» посередине меню: одна кнопка на все «создать» — найти запчасть, позвать мастера, «сломалась машина».
 * Чуть приподнята над меню и залита фирменным цветом, чтобы её находили не читая.
 */
export function CenterActionButton({ onPress, icon: Icon, label }: { onPress: () => void; icon: ComponentType<IconProps>; label: string }) {
	const c = useColors()
	return (
		<Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={{ flex: 1, alignItems: 'center' }}>
			<View
				style={{
					width: 54,
					height: 54,
					marginTop: -10,
					borderRadius: 27,
					backgroundColor: c.brand,
					alignItems: 'center',
					justifyContent: 'center',
					shadowColor: c.brand,
					shadowOpacity: 0.35,
					shadowOffset: { width: 0, height: 6 },
					shadowRadius: 10,
					elevation: 8,
				}}
			>
				<Icon size={26} color={fixed.white} strokeWidth={2.6} />
			</View>
		</Pressable>
	)
}

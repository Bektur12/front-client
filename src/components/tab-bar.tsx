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
 * «＋» над серединой меню (над «Рынком»): одна кнопка на все «создать» — найти запчасть, позвать мастера,
 * «сломалась машина». Висит над меню, вкладка под ней нажимается как обычно; фирменный цвет — находят не читая.
 */
/** Сколько места над меню занимает «＋»: прижатое к низу экрана (полоса «Не нашли?») поднимается на столько. */
export const CENTER_ACTION_ROOM = 68

export function CenterActionButton({ onPress, icon: Icon, label }: { onPress: () => void; icon: ComponentType<IconProps>; label: string }) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	return (
		<View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 72 + insets.bottom + 6, alignItems: 'center' }}>
			<Pressable
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				hitSlop={6}
				style={{
					width: 56,
					height: 56,
					borderRadius: 28,
					backgroundColor: c.brand,
					borderWidth: 3,
					borderColor: c.surface,
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
			</Pressable>
		</View>
	)
}

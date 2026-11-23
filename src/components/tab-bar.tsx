import { forwardRef, type ComponentType, type Ref } from 'react'
import { Pressable, Text, View, type HostInstance, type PressableProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import type { IconProps } from '@/components/icons'

/** Высота плашки меню. */
const BAR_HEIGHT = 64
/** Отступ плашки от низа (над home indicator / системными кнопками). */
const BAR_GAP = 8
/** Круг «＋». */
const ACTION_SIZE = 56

/**
 * Нижнее меню — плавающая скруглённая плашка с тенью и отступами от краёв. Отступ под системные кнопки
 * (home indicator iPhone, «назад / домой» Android) добавляется снизу, а не съедает высоту плашки.
 */
export function TabBarContainer({ children }: { children: React.ReactNode }) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	return (
		<View style={{ backgroundColor: c.surface, paddingHorizontal: 12, paddingTop: 6, paddingBottom: insets.bottom + BAR_GAP }}>
			<View
				style={{
					height: BAR_HEIGHT,
					borderRadius: BAR_HEIGHT / 2,
					backgroundColor: c.card,
					borderWidth: 1,
					borderColor: c.hairline,
					paddingHorizontal: 6,
					flexDirection: 'row',
					alignItems: 'center',
					shadowColor: fixed.shadow,
					shadowOpacity: 0.12,
					shadowOffset: { width: 0, height: 6 },
					shadowRadius: 16,
					elevation: 8,
				}}
			>
				{children}
			</View>
		</View>
	)
}

interface TabButtonProps extends PressableProps {
	isFocused?: boolean
	icon: ComponentType<IconProps>
	label: string
	badge?: number
	/** Иконку закрывает «＋» над серединой меню — остаётся только подпись. */
	underAction?: boolean
}

export const TabButton = forwardRef(function TabButton(
	{ isFocused, icon: Icon, label, badge, underAction, ...props }: TabButtonProps,
	ref: Ref<HostInstance>,
) {
	const c = useColors()
	const color = isFocused ? c.ink : c.fillInk

	return (
		<Pressable ref={ref} {...props} style={{ flex: 1, height: BAR_HEIGHT - 10, justifyContent: 'center', alignItems: 'center' }}>
			{/* Активная вкладка — светлая пилюля, как в современных меню. */}
			<View
				style={{
					minWidth: 60,
					height: BAR_HEIGHT - 12,
					paddingHorizontal: 8,
					borderRadius: (BAR_HEIGHT - 12) / 2,
					backgroundColor: isFocused && !underAction ? c.fill : 'transparent',
					alignItems: 'center',
					justifyContent: underAction ? 'flex-end' : 'center',
					paddingBottom: underAction ? 7 : 0,
					gap: 3,
				}}
			>
				{underAction ? null : (
					<View style={{ width: 30, height: 26, alignItems: 'center', justifyContent: 'center' }}>
						<Icon size={24} color={color} strokeWidth={isFocused ? 2.2 : 1.9} />
						{badge ? (
							<View
								style={{
									position: 'absolute',
									top: -4,
									right: -8,
									minWidth: 18,
									height: 18,
									paddingHorizontal: 5,
									borderRadius: 9,
									backgroundColor: c.danger,
									borderWidth: 2,
									borderColor: c.card,
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								<Text style={{ fontSize: fs.xxs, fontFamily: fontFamily(700), color: fixed.white }}>{badge}</Text>
							</View>
						) : null}
					</View>
				)}
				<Text numberOfLines={1} style={{ fontSize: fs.xs, fontFamily: fontFamily(isFocused ? 700 : 600), color }}>
					{label}
				</Text>
			</View>
		</Pressable>
	)
})

/** Сколько «＋» выступает над меню: прижатое к низу экрана (полоса «Не нашли?») поднимается на столько. */
export const CENTER_ACTION_ROOM = ACTION_SIZE / 2 + 6

/**
 * «＋» прилеплен к верхнему краю меню посередине (над «Рынком»): одна кнопка на все «создать» — найти запчасть,
 * позвать мастера, «сломалась машина». Белая обводка отделяет его от плашки, фирменный цвет — находят не читая.
 */
export function CenterActionButton({ onPress, icon: Icon, label }: { onPress: () => void; icon: ComponentType<IconProps>; label: string }) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	// центр круга — на верхнем крае плашки
	const bottom = insets.bottom + BAR_GAP + BAR_HEIGHT - ACTION_SIZE / 2
	return (
		<View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center' }}>
			<Pressable
				onPress={onPress}
				accessibilityRole="button"
				accessibilityLabel={label}
				hitSlop={4}
				style={{
					width: ACTION_SIZE,
					height: ACTION_SIZE,
					borderRadius: ACTION_SIZE / 2,
					backgroundColor: c.brand,
					borderWidth: 4,
					borderColor: c.card,
					alignItems: 'center',
					justifyContent: 'center',
					shadowColor: c.brand,
					shadowOpacity: 0.35,
					shadowOffset: { width: 0, height: 6 },
					shadowRadius: 10,
					elevation: 10,
				}}
			>
				<Icon size={26} color={fixed.white} strokeWidth={2.6} />
			</Pressable>
		</View>
	)
}

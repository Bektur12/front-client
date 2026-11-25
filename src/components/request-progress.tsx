import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { formatPrice } from '@/lib/format'
import { fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

/**
 * Живой статус запроса, как «ищем машину» в такси: «Получили 12 → Посмотрели 5 → Есть 2».
 * Ожидание не пугает, когда видно, что дело идёт. Текущий шаг пульсирует, пока запрос активен.
 */
export function RequestProgress({
	sent,
	seen,
	have,
	active,
	prices,
}: {
	sent: number
	seen: number
	have: number
	active: boolean
	/** Цены из ответов «Есть» — вилка «от … до …». */
	prices: number[]
}) {
	const c = useColors()
	const steps = [
		{ label: t('Получили'), value: sent },
		{ label: t('Посмотрели'), value: seen },
		{ label: t('Есть'), value: have },
	]
	// Текущий шаг — последний, до которого дошли; пока никто не посмотрел — первый.
	const current = have > 0 ? 2 : seen > 0 ? 1 : 0
	const min = prices.length ? Math.min(...prices) : null
	const max = prices.length ? Math.max(...prices) : null

	return (
		<View style={{ borderRadius: 16, backgroundColor: c.card, paddingVertical: 14, paddingHorizontal: 14, gap: 12 }}>
			<View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
				{steps.map((step, index) => {
					// никому не ушло — ни одна точка не горит
					const done = sent > 0 && index <= current
					return (
						<View key={step.label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
							<View style={{ width: '100%', height: 22, alignItems: 'center', justifyContent: 'center' }}>
								{/* линия к соседям: закрашена до текущего шага */}
								{index > 0 ? (
									<View style={{ position: 'absolute', left: 0, right: '50%', height: 3, borderRadius: 2, backgroundColor: done ? c.brand : c.border }} />
								) : null}
								{index < steps.length - 1 ? (
									<View style={{ position: 'absolute', left: '50%', right: 0, height: 3, borderRadius: 2, backgroundColor: sent > 0 && index < current ? c.brand : c.border }} />
								) : null}
								<Dot done={done} pulse={active && sent > 0 && index === current} />
							</View>
							<Text style={{ fontSize: fs.h3, lineHeight: 26, fontFamily: fontFamily(800), color: done ? c.ink : c.muted }}>{step.value}</Text>
							<Text style={{ fontSize: fs.xs, fontFamily: fontFamily(600), color: c.muted }}>{step.label}</Text>
						</View>
					)
				})}
			</View>
			{min != null && max != null ? (
				<View style={{ borderTopWidth: 1, borderTopColor: c.hairline, paddingTop: 10, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.muted }}>{t('Цены')}</Text>
					<Text style={{ flex: 1, fontSize: fs.lg, fontFamily: fontFamily(800), color: c.ink }}>
						{min === max ? formatPrice(min) : t('от {0} до {1}', formatPrice(min), formatPrice(max))}
					</Text>
				</View>
			) : null}
		</View>
	)
}

function Dot({ done, pulse }: { done: boolean; pulse: boolean }) {
	const c = useColors()
	const wave = useSharedValue(0)
	useEffect(() => {
		if (!pulse) return
		wave.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1, false)
		return () => {
			cancelAnimation(wave)
			wave.value = 0
		}
	}, [pulse, wave])
	const ring = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - wave.value), transform: [{ scale: 0.8 + 1.1 * wave.value }] }))
	return (
		<View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
			{pulse ? (
				<Animated.View style={[{ position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: c.brand }, ring]} />
			) : null}
			<View
				style={{
					width: 14,
					height: 14,
					borderRadius: 7,
					backgroundColor: done ? c.brand : c.surface,
					borderWidth: done ? 0 : 2,
					borderColor: c.border,
				}}
			/>
		</View>
	)
}

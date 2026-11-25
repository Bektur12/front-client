import { useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, useWindowDimensions } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Image } from '@/components/ui/image'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { getItem, setItem } from '@/lib/secure-storage'

/** How long the card holds before the app shows through. */
const HOLD_MS = 4000
/** The line under the card — a different one each launch. Approved by the owner; in Russian on purpose. */
const TAGLINES = [
	'Запчасти ищем мы, а не вы',
	'Машина капризничает? Мы её уговорим',
	'Бегать по рынку больше не надо',
	'Обходить 500 контейнеров? Не, не слышали',
	'Машине — запчасть, вам — спокойствие',
	'Не плачь, машинка, мы здесь',
	'Мастер ближе, чем вы думаете',
	'Голосом, фото, как угодно — поймём',
	'Покажите фото — дальше наше дело',
	'Деталь потерялась? Объявим розыск',
]
const LAST_TAGLINE = 'intro.lastTagline'

/** A random line, never the one shown last time. */
async function nextTagline() {
	const saved = await getItem(LAST_TAGLINE).catch(() => null)
	const last = saved === null ? -1 : Number(saved)
	const choices = TAGLINES.map((_, i) => i).filter((i) => i !== last)
	const pick = choices[Math.floor(Math.random() * choices.length)]
	setItem(LAST_TAGLINE, String(pick)).catch(() => {})
	return TAGLINES[pick]
}

/**
 * On launch: the sign-in brand card — the moving gear on its blue blueprint, KUDAIBERDI on it — in the middle of
 * the app's own background, a joke line under it, then a soft fade into the app. Once per launch; taps go through.
 */
export function IntroSplash({ onDone }: { onDone: () => void }) {
	const c = useColors()
	const { width } = useWindowDimensions()
	const cardWidth = Math.min(width - 40, 440)
	const player = useVideoPlayer(require('../../assets/video/login-loop.mp4'), (p) => {
		p.loop = true
		p.muted = true
		p.play()
	})
	const [card] = useState(() => new Animated.Value(0))
	const [line] = useState(() => new Animated.Value(0))
	const [fade] = useState(() => new Animated.Value(1))
	const [tagline, setTagline] = useState('')

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined
		nextTagline().then(setTagline)
		AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
			const ms = (n: number) => (reduce ? 0 : n)
			Animated.timing(card, { toValue: 1, duration: ms(550), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
			Animated.timing(line, { toValue: 1, duration: ms(600), delay: ms(700), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
			timer = setTimeout(
				() => Animated.timing(fade, { toValue: 0, duration: ms(450) || 150, useNativeDriver: true }).start(() => onDone()),
				reduce ? 1200 : HOLD_MS
			)
		})
		return () => clearTimeout(timer)
	}, [card, line, fade, onDone])

	return (
		<Animated.View
			pointerEvents="none"
			// elevation: on Android cards with a shadow (elevation) of the screen below draw over a plain zIndex — their
			// shadows showed through the card. Higher than any in the app.
			style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 1000, opacity: fade, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', gap: 22 }]}
		>
			<Animated.View
				style={{
					width: cardWidth,
					aspectRatio: 1086 / 690,
					borderRadius: 28,
					overflow: 'hidden',
					backgroundColor: fixed.brandCard,
					opacity: card,
					transform: [{ scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
				}}
			>
				<Image source={require('../../assets/video/login-poster.jpg')} style={StyleSheet.absoluteFill} />
				<VideoView player={player} nativeControls={false} contentFit="cover" style={StyleSheet.absoluteFill} />
				<Text style={{ position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontSize: fs.display, lineHeight: 36, fontFamily: fontFamily(800), letterSpacing: -0.5, color: fixed.white }}>
					KUDAIBERDI
				</Text>
			</Animated.View>
			<Animated.View
				style={{
					paddingHorizontal: 28,
					opacity: line,
					transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
				}}
			>
				<Text style={{ textAlign: 'center', fontSize: 21, lineHeight: 28, fontFamily: fontFamily(700), color: c.brandStrong }}>{tagline}</Text>
			</Animated.View>
		</Animated.View>
	)
}

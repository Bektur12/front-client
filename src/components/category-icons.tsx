// Иконки категорий запчастей — в стиле иконок меню: viewBox 24, обводка, скруглённые концы.
import type { ReactNode } from 'react'
import { View } from 'react-native'
import { fixed, useColors } from '@/theme'
import { Image } from '@/components/ui/image'
import { categoryImages } from '@/data/category-images'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

const SHAPES: Record<string, ReactNode> = {
	// амортизатор с пружиной
	suspension: (
		<>
			<Path d="M12 2v4M12 18v4" />
			<Rect x={8} y={6} width={8} height={2.5} rx={1} />
			<Path d="m8.5 10.5 7 1.5-7 1.5 7 1.5-7 1.5" />
		</>
	),
	// диск и суппорт
	brakes: (
		<>
			<Circle cx={11} cy={13} r={8} />
			<Circle cx={11} cy={13} r={2.5} />
			<Path d="M15 3.2a10 10 0 0 1 5.8 5.8" />
		</>
	),
	// блок двигателя
	engine: (
		<>
			<Path d="M9 4.5h6M12 4.5V7" />
			<Path d="M5 10h2V7h9l2 3h2v6h-2l-2 3H8l-3-3z" />
			<Path d="M2.5 11v4M2.5 13H5" />
		</>
	),
	// фара с лучами
	lights: (
		<>
			<Path d="M11 5.5C6.5 5.5 4 8.4 4 12s2.5 6.5 7 6.5z" />
			<Path d="M14.5 8H20M14.5 12H20M14.5 16H20" />
		</>
	),
	// машина сбоку
	body: (
		<>
			<Path d="M5 16.5H3v-3.5l2.5-5h10l3.5 5h2v3.5h-2" />
			<Path d="M9 16.5h6M5.5 13h13.5" />
			<Circle cx={7} cy={16.5} r={2} />
			<Circle cx={17} cy={16.5} r={2} />
		</>
	),
	// молния
	electrics: <Path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" />,
	// термометр и волна антифриза
	cooling: (
		<>
			<Path d="M12 2.5a2 2 0 0 0-2 2v7.2a3.5 3.5 0 1 0 4 0V4.5a2 2 0 0 0-2-2z" />
			<Path d="M3 21.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0" />
		</>
	),
	// схема передач
	transmission: (
		<>
			<Circle cx={6} cy={5} r={1.8} />
			<Circle cx={12} cy={5} r={1.8} />
			<Circle cx={18} cy={5} r={1.8} />
			<Circle cx={6} cy={19} r={1.8} />
			<Circle cx={12} cy={19} r={1.8} />
			<Path d="M6 6.8v10.4M12 6.8v10.4M18 6.8V12H6" />
		</>
	),
	// сиденье
	interior: (
		<>
			<Path d="M9.5 12 8.6 4A1.8 1.8 0 0 1 10.4 2h1.4a1.8 1.8 0 0 1 1.8 2L12.6 12" />
			<Path d="M7 12h10a2 2 0 0 1 2 2v2.5H9a2 2 0 0 1-2-2z" />
			<Path d="M10 16.5V21M16.5 16.5V21" />
		</>
	),
	// масляный фильтр
	service: (
		<>
			<Rect x={6} y={6.5} width={12} height={14.5} rx={2} />
			<Path d="M9 6.5V3.5h6v3M10 10.5v6.5M14 10.5v6.5" />
		</>
	),
	// аккумулятор
	batteries: (
		<>
			<Rect x={3} y={7} width={18} height={13} rx={2} />
			<Path d="M6.5 7V4.5h3V7M14.5 7V4.5h3V7M6.5 13.5h3.5M8.25 11.75v3.5M14 13.5h3.5" />
		</>
	),
	// колесо
	tires: (
		<>
			<Circle cx={12} cy={12} r={9} />
			<Circle cx={12} cy={12} r={4} />
			<Path d="M12 3v5M12 16v5M3 12h5M16 12h5" />
		</>
	),
	// канистра с каплей
	oils: (
		<>
			<Path d="M6.5 7h8l3.5 3.5V19a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
			<Path d="M8 7V4h4.5v3" />
			<Path d="M11 11.5c-1.4 1.7-2 2.8-2 3.7a2 2 0 0 0 4 0c0-.9-.6-2-2-3.7z" />
		</>
	),
	// руль
	steering: (
		<>
			<Circle cx={12} cy={12} r={9} />
			<Circle cx={12} cy={12} r={2.5} />
			<Path d="M3.4 10.6 9.6 11.6M20.6 10.6l-6.2 1M12 14.5V21" />
		</>
	),
	// глушитель и дым
	exhaust: (
		<>
			<Rect x={3.5} y={10} width={11} height={6} rx={3} />
			<Path d="M1.5 13h2M14.5 13h3.5" />
			<Path d="M20 9.5c1.2.6 1.2 1.9 0 2.5M20 14c1.2.6 1.2 1.9 0 2.5" />
		</>
	),
	// заправочная колонка
	fuel: (
		<>
			<Path d="M4.5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M3 21h12" />
			<Path d="M7 7h4v4H7z" />
			<Path d="M13.5 10H16a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3" />
		</>
	),
	// снежинка — кондиционер
	climate: (
		<>
			<Path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5" />
			<Path d="m9.5 3.5 2.5 2 2.5-2M9.5 20.5l2.5-2 2.5 2" />
		</>
	),
	// лобовое стекло с дворником
	glass: (
		<>
			<Path d="M5.5 5.5h13l2.5 12H3z" />
			<Path d="m8 16.5 5-6.5" />
		</>
	),
	// динамик
	audio: (
		<>
			<Path d="M4 9h3.5L13 4.5v15L7.5 15H4z" />
			<Path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
		</>
	),
	// блеск — тюнинг
	accessories: (
		<>
			<Path d="M11 3c.7 4.6 1.9 5.8 6.5 6.5-4.6.7-5.8 1.9-6.5 6.5-.7-4.6-1.9-5.8-6.5-6.5C9.1 8.8 10.3 7.6 11 3z" />
			<Path d="M18.5 14.5c.3 1.8.8 2.3 2.5 2.5-1.7.2-2.2.7-2.5 2.5-.3-1.8-.8-2.3-2.5-2.5 1.7-.2 2.2-.7 2.5-2.5z" />
		</>
	),
	// коробка — всё остальное
	other: (
		<>
			<Path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
			<Path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
			<Path d="m7.8 5.3 8.4 4.5" />
		</>
	),
	// гаечный ключ
	tools: (
		<Path d="M14.7 6.3a4 4 0 0 0-5.4 5.1l-5.9 5.9a1.8 1.8 0 0 0 2.5 2.5l5.9-5.9a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.3-.4-.4-2.3z" />
	),
}

/** Иконка категории по slug; незнакомая категория — гаечный ключ. */
export function CategoryIcon({ slug, size = 26, color, strokeWidth = 1.7 }: { slug: string; size?: number; color: string; strokeWidth?: number }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
			{SHAPES[slug] ?? SHAPES.tools}
		</Svg>
	)
}

/** Стрелки для плитки «Все категории» / «Свернуть». */
export function GridToggleIcon({ open, size = 26, color }: { open: boolean; size?: number; color: string }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
			{open ? <Path d="m6 15 6-6 6 6" /> : (
				<>
					<Rect x={3.5} y={3.5} width={7} height={7} rx={2} />
					<Rect x={13.5} y={3.5} width={7} height={7} rx={2} />
					<Rect x={3.5} y={13.5} width={7} height={7} rx={2} />
					<Rect x={13.5} y={13.5} width={7} height={7} rx={2} />
				</>
			)}
		</Svg>
	)
}

/**
 * Строгий монохром, как в профессиональных каталогах запчастей: тёмная линия на нейтральной серой плашке.
 * Без цветов — категории различаются формой иконки, экран спокойный и деловой.
 */
export function CategoryBadge({ slug, size = 48 }: { slug: string; size?: number }) {
	const c = useColors()
	const picture = categoryImages[slug]
	if (picture) {
		// a real picture of the part on a light square — light in both themes, like brand logos
		return <Image source={picture} contentFit="cover" transition={0} style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: fixed.white }} />
	}
	return (
		<View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
			<CategoryIcon slug={slug} size={size * 0.56} color={c.ink} strokeWidth={1.8} />
		</View>
	)
}

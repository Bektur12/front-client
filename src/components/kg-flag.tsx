import Svg, { Circle, G, Line, Rect } from 'react-native-svg'

/** The Kyrgyz flag: red field, the yellow sun with 40 rays and the tunduk in it. Drawn, so it looks the same on every phone. */
export function KgFlag({ width = 30 }: { width?: number }) {
	const rays = Array.from({ length: 40 }, (_, i) => (i / 40) * Math.PI * 2)
	return (
		<Svg width={width} height={(width * 3) / 5} viewBox="0 0 50 30">
			<Rect width={50} height={30} rx={3} fill="#E8112D" />
			<G>
				{rays.map((a, i) => (
					<Line key={i} x1={25 + Math.cos(a) * 5.4} y1={15 + Math.sin(a) * 5.4} x2={25 + Math.cos(a) * 9} y2={15 + Math.sin(a) * 9} stroke="#FFEF00" strokeWidth={0.9} />
				))}
			</G>
			<Circle cx={25} cy={15} r={5.6} fill="#FFEF00" />
			<Circle cx={25} cy={15} r={3.9} fill="#E8112D" />
			<Circle cx={25} cy={15} r={3.1} fill="none" stroke="#FFEF00" strokeWidth={0.8} />
			<Line x1={22.2} y1={13.6} x2={27.8} y2={13.6} stroke="#FFEF00" strokeWidth={0.6} />
			<Line x1={22.2} y1={16.4} x2={27.8} y2={16.4} stroke="#FFEF00" strokeWidth={0.6} />
			<Line x1={23.6} y1={12.2} x2={23.6} y2={17.8} stroke="#FFEF00" strokeWidth={0.6} />
			<Line x1={26.4} y1={12.2} x2={26.4} y2={17.8} stroke="#FFEF00" strokeWidth={0.6} />
		</Svg>
	)
}

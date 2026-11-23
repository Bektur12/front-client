// Палитра карты рынка — общая для веба (maplibre-gl) и телефона (maplibre-react-native).
// «Тёплый полдень»: песочная земля, белые крыши, золотые проходы, рынок светится, как фонарь.
// Выбранный контейнер (target) — сплошной фирменный синий, как главная кнопка; продавцы из приложения —
// светло-голубые с синей обводкой (brandTint из дизайна): одна гамма, но выбранный сразу виден.

export interface MapPalette {
	/** Подложка OpenStreetMap. */
	ground: string
	block: string
	green: string
	water: string
	building: string
	buildingTop: string
	buildingShadow: string
	road: string
	roadCasing: string
	roadLabel: string
	roadLabelHalo: string
	/** Свет для объёма: цвет и сила. */
	light: { color: string; intensity: number }
	/** Небо и дымка у горизонта (на вебе). */
	sky: { sky: string; horizon: string; fog: string }
	/** Рынок. */
	plot: string
	plotGlow: string
	plotEdge: string
	passage: string
	passageGlow: string
	passageEdge: string
	row: string
	rowEdge: string
	rowMuted: string
	rowMutedEdge: string
	rowHl: string
	rowHlEdge: string
	shopBlock: string
	shopBlockEdge: string
	admin: string
	adminEdge: string
	stall: string
	/** Контейнеры: крыша, продавец, погасшие (выбран другой). */
	cell: string
	cellShop: string
	cellShopGlow: string
	cellDim: string
	cellShopDim: string
	/** Найден фильтром (марка, категория) — горит сплошным синим. */
	cellHl: string
	cellShadow: string
	cellText: string
	cellTextHalo: string
	cellTextDim: string
	shopText: string
	shopTextHalo: string
	label: string
	labelHl: string
	labelHalo: string
	/** Магазины и сервисы со справочника (карты рынков без контейнеров): точка запчастей, прочих, подпись. */
	placeParts: string
	placeOther: string
	placeText: string
	entrance: string
	entranceRing: string
	entranceText: string
	/** Нужный контейнер. */
	target: string
	route: string
	routeEnd: string
	routeGlow: string
	routeFlow: string
	/** Затемнение по краям экрана (на вебе). */
	vignette: string
}

/** Палитра карты рынка. */
export const mapPalette: MapPalette = {
	ground: '#EFEAE2',
	block: '#E7E1D7',
	green: '#D5E6CB',
	water: '#BCD7EA',
	building: '#F3EFE8',
	buildingTop: '#FFFFFF',
	buildingShadow: 'rgba(92,72,40,0.16)',
	road: '#FFFFFF',
	roadCasing: '#DED5C8',
	roadLabel: '#8F857A',
	roadLabelHalo: '#FFFFFF',
	light: { color: '#FFF4E0', intensity: 0.28 },
	sky: { sky: '#A9D2FF', horizon: '#FFE6C8', fog: '#EFEAE2' },
	plot: '#FBF6EE',
	plotGlow: '#FFC24D',
	plotEdge: '#E39B1E',
	passage: '#FFE6A0',
	passageGlow: '#FFD36B',
	passageEdge: '#EBCB7E',
	row: '#E3E9F3',
	rowEdge: '#BFCADC',
	rowMuted: '#EDEFF3',
	rowMutedEdge: '#DCE0E7',
	rowHl: '#DCE6FF',
	rowHlEdge: '#2155E6',
	shopBlock: '#ECE7E0',
	shopBlockEdge: '#D5CDC2',
	admin: '#E8E1F3',
	adminEdge: '#C8BDE0',
	stall: 'rgba(255,255,255,0.7)',
	cell: '#FFFFFF',
	cellShop: '#D3E0FF',
	cellShopGlow: '#2155E6',
	cellDim: '#E9ECF1',
	cellShopDim: '#E6ECFA',
	cellHl: '#2155E6',
	cellShadow: 'rgba(40,52,80,0.28)',
	cellText: '#1A1C20',
	cellTextHalo: '#FFFFFF',
	cellTextDim: '#A6AEB9',
	shopText: '#1D46BF',
	shopTextHalo: '#FFFFFF',
	label: '#2A2F38',
	labelHl: '#1D46BF',
	labelHalo: '#FFFFFF',
	placeParts: '#2155E6',
	placeOther: '#6B7686',
	placeText: '#1D2A44',
	entrance: '#1A1C20',
	entranceRing: '#2155E6',
	entranceText: '#1D46BF',
	target: '#2155E6',
	route: '#7FA0FF',
	routeEnd: '#2155E6',
	routeGlow: '#4C7BFF',
	routeFlow: '#FFFFFF',
	vignette: 'rgba(120,96,60,0.16)',
}

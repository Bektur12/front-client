// Источник: design/brands.json. Логотипы — файлы в assets/brands (79 марок); у остальных цветная буква-заглушка.
/** A bundled logo (`require`) or a remote one. */
export type LogoSource = number | { uri: string }

export interface Brand {
	name: string
	slug: string
	placeholder: string
	color: string
	logo: LogoSource | null
}

/**
 * Bundled logos — shown instantly and offline; a brand without a file uses the server's `logoUrl`, else the letter.
 * Source: github.com/filippofilip95/car-logos-dataset (MIT), resized to 160 px. No file yet: Ravon, Москвич, Tank, Voyah,
 * tractors and machinery (МТЗ, John Deere, JCB, CAT…) — those show the letter.
 */
export const logos: Record<string, LogoSource> = {
	acura: require('../../assets/brands/acura.png'),
	'alfa-romeo': require('../../assets/brands/alfa-romeo.png'),
	audi: require('../../assets/brands/audi.png'),
	bmw: require('../../assets/brands/bmw.png'),
	byd: require('../../assets/brands/byd.png'),
	cadillac: require('../../assets/brands/cadillac.png'),
	changan: require('../../assets/brands/changan.png'),
	chery: require('../../assets/brands/chery.png'),
	chevrolet: require('../../assets/brands/chevrolet.png'),
	chrysler: require('../../assets/brands/chrysler.png'),
	citroen: require('../../assets/brands/citroen.png'),
	daewoo: require('../../assets/brands/daewoo.png'),
	daf: require('../../assets/brands/daf.png'),
	daihatsu: require('../../assets/brands/daihatsu.png'),
	datsun: require('../../assets/brands/datsun.png'),
	dodge: require('../../assets/brands/dodge.png'),
	dongfeng: require('../../assets/brands/dongfeng.png'),
	exeed: require('../../assets/brands/exeed.png'),
	faw: require('../../assets/brands/faw.png'),
	fiat: require('../../assets/brands/fiat.png'),
	ford: require('../../assets/brands/ford.png'),
	foton: require('../../assets/brands/foton.png'),
	gaz: require('../../assets/brands/gaz.png'),
	geely: require('../../assets/brands/geely.png'),
	genesis: require('../../assets/brands/genesis.png'),
	gmc: require('../../assets/brands/gmc.png'),
	'great-wall': require('../../assets/brands/great-wall.png'),
	haval: require('../../assets/brands/haval.png'),
	hino: require('../../assets/brands/hino.png'),
	honda: require('../../assets/brands/honda.png'),
	hongqi: require('../../assets/brands/hongqi.png'),
	hummer: require('../../assets/brands/hummer.png'),
	hyundai: require('../../assets/brands/hyundai.png'),
	infiniti: require('../../assets/brands/infiniti.png'),
	isuzu: require('../../assets/brands/isuzu.png'),
	iveco: require('../../assets/brands/iveco.png'),
	jac: require('../../assets/brands/jac.png'),
	jaguar: require('../../assets/brands/jaguar.png'),
	jeep: require('../../assets/brands/jeep.png'),
	jetour: require('../../assets/brands/jetour.png'),
	kamaz: require('../../assets/brands/kamaz.png'),
	kia: require('../../assets/brands/kia.png'),
	lada: require('../../assets/brands/lada.png'),
	'land-rover': require('../../assets/brands/land-rover.png'),
	lexus: require('../../assets/brands/lexus.png'),
	'li-auto': require('../../assets/brands/li-auto.png'),
	lifan: require('../../assets/brands/lifan.png'),
	lincoln: require('../../assets/brands/lincoln.png'),
	'lynk-co': require('../../assets/brands/lynk-co.png'),
	man: require('../../assets/brands/man.png'),
	maz: require('../../assets/brands/maz.png'),
	mazda: require('../../assets/brands/mazda.png'),
	'mercedes-benz': require('../../assets/brands/mercedes-benz.png'),
	mini: require('../../assets/brands/mini.png'),
	mitsubishi: require('../../assets/brands/mitsubishi.png'),
	nissan: require('../../assets/brands/nissan.png'),
	omoda: require('../../assets/brands/omoda.png'),
	opel: require('../../assets/brands/opel.png'),
	peugeot: require('../../assets/brands/peugeot.png'),
	porsche: require('../../assets/brands/porsche.png'),
	renault: require('../../assets/brands/renault.png'),
	saab: require('../../assets/brands/saab.png'),
	scania: require('../../assets/brands/scania.png'),
	seat: require('../../assets/brands/seat.png'),
	shacman: require('../../assets/brands/shacman.png'),
	sinotruk: require('../../assets/brands/sinotruk.png'),
	skoda: require('../../assets/brands/skoda.png'),
	smart: require('../../assets/brands/smart.png'),
	ssangyong: require('../../assets/brands/ssangyong.png'),
	subaru: require('../../assets/brands/subaru.png'),
	suzuki: require('../../assets/brands/suzuki.png'),
	tesla: require('../../assets/brands/tesla.png'),
	toyota: require('../../assets/brands/toyota.png'),
	uaz: require('../../assets/brands/uaz.png'),
	volkswagen: require('../../assets/brands/volkswagen.png'),
	volvo: require('../../assets/brands/volvo.png'),
	yutong: require('../../assets/brands/yutong.png'),
	zaz: require('../../assets/brands/zaz.png'),
	zeekr: require('../../assets/brands/zeekr.png'),
}

export const brands: Brand[] = [
	{ name: 'Toyota', slug: 'toyota', placeholder: 'T', color: '#D92D2D', logo: logos.toyota },
	{ name: 'Lexus', slug: 'lexus', placeholder: 'L', color: '#3F3F46', logo: logos.lexus },
	{ name: 'Honda', slug: 'honda', placeholder: 'H', color: '#B91C1C', logo: logos.honda },
	{ name: 'Nissan', slug: 'nissan', placeholder: 'N', color: '#6B7280', logo: logos.nissan },
	{ name: 'Mercedes-Benz', slug: 'mercedes-benz', placeholder: 'MB', color: '#1F2937', logo: logos['mercedes-benz'] },
	{ name: 'BMW', slug: 'bmw', placeholder: 'BMW', color: '#1C69D4', logo: null },
	{ name: 'Hyundai', slug: 'hyundai', placeholder: 'H', color: '#0B3D91', logo: null },
	{ name: 'Kia', slug: 'kia', placeholder: 'K', color: '#111827', logo: null },
	{ name: 'Mitsubishi', slug: 'mitsubishi', placeholder: 'M', color: '#DC2626', logo: null },
	{ name: 'Subaru', slug: 'subaru', placeholder: 'S', color: '#1E40AF', logo: null },
	{ name: 'Volkswagen', slug: 'volkswagen', placeholder: 'VW', color: '#1E3A8A', logo: null },
	{ name: 'Audi', slug: 'audi', placeholder: 'A', color: '#525252', logo: null },
	{ name: 'Mazda', slug: 'mazda', placeholder: 'M', color: '#374151', logo: null },
	{ name: 'Chevrolet', slug: 'chevrolet', placeholder: 'C', color: '#B8860B', logo: null },
	{ name: 'Daewoo', slug: 'daewoo', placeholder: 'D', color: '#2563EB', logo: null },
	{ name: 'Lada', slug: 'lada', placeholder: 'Л', color: '#4B5563', logo: null },
	{ name: 'Opel', slug: 'opel', placeholder: 'O', color: '#CA8A04', logo: null },
	{ name: 'Ford', slug: 'ford', placeholder: 'F', color: '#1D4ED8', logo: null },
]

export function brandBySlug(slug: string): Brand {
	const brand = brands.find((b) => b.slug === slug)
	if (!brand) throw new Error(`Unknown brand slug: ${slug}`)
	return brand
}

/** A `require('…png')` — a bundled image. */
type BundledImage = number

/**
 * Category pictures bundled with the app — shown instantly and offline, by the category's slug.
 * A category without a file keeps its line icon, so pictures can be added one by one:
 * put `assets/categories/<slug>.jpg` (square, light background, 256 px) and add a line here.
 * The pictures are AI-generated in one style (Figma file «Кудайберген — картинки категорий»).
 */
export const categoryImages: Record<string, BundledImage> = {
	accessories: require('../../assets/categories/accessories.jpg'),
	audio: require('../../assets/categories/audio.jpg'),
	batteries: require('../../assets/categories/batteries.jpg'),
	body: require('../../assets/categories/body.jpg'),
	brakes: require('../../assets/categories/brakes.jpg'),
	climate: require('../../assets/categories/climate.jpg'),
	cooling: require('../../assets/categories/cooling.jpg'),
	engine: require('../../assets/categories/engine.jpg'),
	exhaust: require('../../assets/categories/exhaust.jpg'),
	fuel: require('../../assets/categories/fuel.jpg'),
	glass: require('../../assets/categories/glass.jpg'),
	interior: require('../../assets/categories/interior.jpg'),
	lights: require('../../assets/categories/lights.jpg'),
	oils: require('../../assets/categories/oils.jpg'),
	other: require('../../assets/categories/other.jpg'),
	service: require('../../assets/categories/service.jpg'),
	steering: require('../../assets/categories/steering.jpg'),
	suspension: require('../../assets/categories/suspension.jpg'),
	tires: require('../../assets/categories/tires.jpg'),
	transmission: require('../../assets/categories/transmission.jpg'),
}

import { Image } from '@/components/ui/image'

/**
 * Bundled 3D icons (AI-generated in one style, Figma file «Кудайберген — картинки категорий») for menu rows.
 * Transparent PNGs: the white background was cut out, the soft shadow kept semi-transparent.
 */
export const pictureIcons = {
	requests: require('../../assets/icons/requests.png') as number,
	favorites: require('../../assets/icons/favorites.png') as number,
	language: require('../../assets/icons/language.png') as number,
	notifications: require('../../assets/icons/notifications.png') as number,
	help: require('../../assets/icons/help.png') as number,
}

export function PictureIcon({ name, size = 40 }: { name: keyof typeof pictureIcons; size?: number }) {
	return <Image source={pictureIcons[name]} contentFit="contain" transition={0} style={{ width: size, height: size }} />
}

import { Text, View } from 'react-native'
import { fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

/** Home header: «Салам, Айназик!», the car under it. */
export function Greeting({ name, subtitle }: { name?: string | null; subtitle: string }) {
	const c = useColors()
	const first = name?.trim().split(/\s+/)[0]
	return (
		<View style={{ flex: 1 }}>
			<View style={{ gap: 1 }}>
				<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, fontSize: fs.h3, lineHeight: 28, fontFamily: fontFamily(800), letterSpacing: -0.3, color: c.ink }}>
					{t('Салам')}
					{first ? <Text style={{ color: c.brandStrong }}>{`, ${first}`}</Text> : null}!
				</Text>
				<Text numberOfLines={1} style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.muted }}>
					{subtitle}
				</Text>
			</View>
		</View>
	)
}

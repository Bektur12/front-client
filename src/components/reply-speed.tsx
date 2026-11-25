import { Text, View } from 'react-native'
import { FlashIcon } from '@/components/icons'
import { fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

/** Дольше этого — уже не «быстро», бейдж не показываем. */
const FAST_MINUTES = 30

/**
 * «⚡ Отвечает за ~5 мин» — доверие к незнакомому продавцу, как «Отвечает быстро» на Avito.
 * Только быстрым: медленным бейдж не ставим, чтобы не отпугивать — просто ничего.
 */
export function ReplySpeedBadge({ minutes }: { minutes: number | null | undefined }) {
	const c = useColors()
	if (minutes == null || minutes > FAST_MINUTES) return null
	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', height: 24, paddingHorizontal: 8, borderRadius: 8, backgroundColor: c.successSoft }}>
			<FlashIcon size={12} color={c.success} strokeWidth={2.6} />
			<Text numberOfLines={1} style={{ fontSize: fs.xs, fontFamily: fontFamily(700), color: c.successInk }}>
				{minutes <= 1 ? t('Отвечает за минуту') : t('Отвечает за ~{0} мин', minutes)}
			</Text>
		</View>
	)
}

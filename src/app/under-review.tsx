import { useEffect } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui'
import { ClockIcon } from '@/components/icons'
import { fontFamily, fs, useColors } from '@/theme'
import { askForPushAt } from '@/lib/push'
import { resetTo } from '@/lib/navigation'
import { t } from '@/i18n'

/**
 * After a new shop / master profile is saved while moderation is on: the request went to the administration.
 * «Понятно» — to the seller / master home, where the «на проверке» banner stays until it is approved.
 */
export default function UnderReviewScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const { kind } = useLocalSearchParams<{ kind?: 'shop' | 'master' }>()
	const shop = kind !== 'master'
	// The answer comes by push — ask for it right here.
	useEffect(() => {
		askForPushAt(shop ? 'shop' : 'master')
	}, [shop])

	return (
		<View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
			<View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 14 }}>
				<View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandTint, alignItems: 'center', justifyContent: 'center' }}>
					<ClockIcon size={32} color={c.brandStrong} />
				</View>
				<Text style={{ fontSize: fs.h2, fontFamily: fontFamily(800), color: c.ink }}>{t('Заявка отправлена на проверку')}</Text>
				<Text style={{ fontSize: fs.lg, lineHeight: 24, fontFamily: fontFamily(400), color: c.inkSecondary }}>
					{shop
						? t('Администратор проверит магазин в течение 1 рабочего дня. Как только его подтвердят, придёт уведомление и начнут приходить запросы.')
						: t('Администратор проверит профиль в течение 1 рабочего дня. Как только его подтвердят, придёт уведомление и начнут приходить заявки.')}
				</Text>
				<Text style={{ fontSize: fs.lg, lineHeight: 24, fontFamily: fontFamily(400), color: c.inkSecondary }}>
					{t('Если понадобится что-то уточнить, с вами свяжутся по вашему номеру.')}
				</Text>
			</View>
			<View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}>
				<Button label={t('Понятно')} onPress={() => resetTo(shop ? '/seller' : '/master')} />
			</View>
		</View>
	)
}

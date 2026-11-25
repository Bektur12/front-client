import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from '@/components/ui/image'
import { ModalSheet } from '@/components/master-v23'
import { YANDEX_LOGO, YLDAM_LOGO, useYandexCourier } from '@/components/courier-sheet'
import { usePart } from '@/api/catalog'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

/**
 * «Доставка» из ленты видео: кем везти — Яндекс курьер (по Бишкеку сегодня, сразу в Яндекс Go от продавца к вам)
 * или Ылдам Экспресс (по Кыргызстану, оформление в приложении). Место продавца берём из карточки товара.
 */
export function DeliveryChoiceSheet({ partId, onClose }: { partId: number; onClose: () => void }) {
	const part = usePart(partId).data
	const yandex = useYandexCourier(part?.shop)

	const viaYandex = async () => {
		await yandex.call()
		onClose()
	}
	const viaYldam = () => {
		onClose()
		router.push({ pathname: '/delivery', params: { partId: String(partId) } })
	}

	return (
		<ModalSheet onClose={onClose}>
			<Header />
			<View style={{ gap: 10, paddingTop: 4 }}>
				<Option
					logo={YANDEX_LOGO}
					title={t('Яндекс курьер')}
					sub={yandex.opening ? t('Открываем…') : t('По Бишкеку · сегодня')}
					loading={yandex.opening || !part}
					onPress={viaYandex}
				/>
				<Option logo={YLDAM_LOGO} title={t('Ылдам Экспресс')} sub={t('По всему Кыргызстану')} onPress={viaYldam} />
			</View>
		</ModalSheet>
	)
}

function Header() {
	const c = useColors()
	return <Text style={{ fontSize: fs.xl, fontFamily: fontFamily(800), color: c.ink }}>{t('Как доставить?')}</Text>
}

function Option({ logo, title, sub, onPress, loading }: { logo: number; title: string; sub: string; onPress: () => void; loading?: boolean }) {
	const c = useColors()
	return (
		<Pressable onPress={onPress} disabled={loading} accessibilityRole="button">
			<View style={{ borderRadius: 16, backgroundColor: c.surface, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
				<Image source={logo} contentFit="cover" style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: fixed.white }} />
				<View style={{ flex: 1, gap: 2 }}>
					<Text style={{ fontSize: fs.lg, fontFamily: fontFamily(800), color: c.ink }}>{title}</Text>
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.inkSecondary }}>{sub}</Text>
				</View>
				{loading ? <ActivityIndicator color={c.brandStrong} /> : <Text style={{ fontSize: fs.xl, color: c.chevron }}>›</Text>}
			</View>
		</Pressable>
	)
}

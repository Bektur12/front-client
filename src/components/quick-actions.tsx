import type { ComponentType } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { ModalSheet } from '@/components/master-v23'
import { ChevronIcon, LoupeIcon, WrenchIcon } from '@/components/buyer-v23'
import { MarketIcon } from '@/components/icons'
import { requireSignIn } from '@/components/sign-in-prompt'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

type Icon = ComponentType<{ size?: number; color: string; strokeWidth?: number }>

/**
 * Меню «＋» из нижней навигации: главные действия покупателя — одной строкой каждое, без лишнего.
 */
export function QuickActionsSheet({ onClose }: { onClose: () => void }) {
	// Окно закрывается, потом переход: «Нужно войти» поверх закрывающегося окна iOS не показывает.
	const run = (action: () => void) => {
		onClose()
		setTimeout(action, 250)
	}
	return (
		<ModalSheet onClose={onClose}>
			<View style={{ gap: 8, paddingTop: 4 }}>
				<Action
					icon={LoupeIcon}
					title={t('Найти запчасть')}
					sub={t('Фото или голосом — продавцы ответят с ценой')}
					onPress={() => run(() => requireSignIn() && router.push('/search-part'))}
				/>
				<Action
					icon={WrenchIcon}
					title={t('Нужен мастер')}
					sub={t('Ремонт, шиномонтаж, эвакуатор')}
					onPress={() => run(() => requireSignIn(t('Чтобы позвать мастера, войдите по номеру телефона.')) && router.push('/service-new'))}
				/>
				<Action
					icon={MarketIcon}
					title={t('Карта рынка')}
					sub={t('Найти контейнер и пройти к нему')}
					onPress={() => run(() => router.navigate('/buyer/market'))}
				/>
				{/* «Сломалась машина» (/roadside) скрыта до готовности — экран и справочник остаются в коде */}
			</View>
		</ModalSheet>
	)
}

function Action({ icon: Icon, title, sub, danger, onPress }: { icon: Icon; title: string; sub: string; danger?: boolean; onPress: () => void }) {
	const c = useColors()
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 12, backgroundColor: danger ? c.dangerSoft : c.surface }}
		>
			<View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: danger ? c.danger : c.brandTint, alignItems: 'center', justifyContent: 'center' }}>
				<Icon size={22} color={danger ? fixed.white : c.brandStrong} strokeWidth={2} />
			</View>
			<View style={{ flex: 1, gap: 2 }}>
				<Text style={{ fontSize: fs.lg, fontFamily: fontFamily(700), color: danger ? c.danger : c.ink }}>{title}</Text>
				<Text numberOfLines={1} style={{ fontSize: fs.sm, fontFamily: fontFamily(400), color: c.inkSecondary }}>{sub}</Text>
			</View>
			<ChevronIcon size={18} color={danger ? c.danger : c.chevron} />
		</Pressable>
	)
}

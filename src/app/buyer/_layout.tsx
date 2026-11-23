import { useState } from 'react'
import { View } from 'react-native'
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui'
import { CenterActionButton, TabBarContainer, TabButton } from '@/components/tab-bar'
import { QuickActionsSheet } from '@/components/quick-actions'
import { PlusThinIcon } from '@/components/buyer-v23'
import { useUnread } from '@/api/chats'
import { ChatIcon, HomeIcon, ProfileIcon, SearchIcon } from '@/components/icons'
import { t } from '@/i18n'
import { useSignedIn } from '@/api/catalog'

/**
 * Buyer tabs: Главная · Запчасти · ＋ · Чаты · Профиль. «＋» — найти запчасть, мастер, карта рынка, «сломалась машина».
 * «Рынок» (карта) — не вкладка: плитки рынков на главной и строка в «＋»; маршрут /buyer/market остаётся в TabList.
 */
export default function BuyerLayout() {
	// Unread chats for this side — counted on the server, kept live by the UNREAD event.
	const signedIn = useSignedIn()
	const unread = useUnread(signedIn).data?.asBuyer ?? 0
	// «＋» посередине: найти запчасть, позвать мастера, «сломалась машина» — одним касанием с любой вкладки.
	const [actions, setActions] = useState(false)

	return (
		<Tabs>
			<TabSlot style={{ flex: 1 }} />

			<TabBarContainer>
				<TabTrigger name="home" asChild>
					<TabButton icon={HomeIcon} label={t('Главная')} />
				</TabTrigger>
				<TabTrigger name="parts" asChild>
					<TabButton icon={SearchIcon} label={t('Запчасти')} />
				</TabTrigger>
				{/* место под «＋» посередине меню */}
				<View style={{ width: 64 }} />
				<TabTrigger name="chats" asChild>
					<TabButton icon={ChatIcon} label={t('Чаты')} badge={unread || undefined} />
				</TabTrigger>
				<TabTrigger name="profile" asChild>
					<TabButton icon={ProfileIcon} label={t('Профиль')} />
				</TabTrigger>
			</TabBarContainer>
			<CenterActionButton icon={PlusThinIcon} label={t('Найти запчасть, мастера или помощь')} onPress={() => setActions(true)} />

			<TabList style={{ display: 'none' }}>
				<TabTrigger name="home" href="/buyer" />
				<TabTrigger name="parts" href="/buyer/parts" />
				<TabTrigger name="market" href="/buyer/market" />
				<TabTrigger name="chats" href="/buyer/chats" />
				<TabTrigger name="profile" href="/buyer/profile" />
			</TabList>
			{actions ? <QuickActionsSheet onClose={() => setActions(false)} /> : null}
		</Tabs>
	)
}

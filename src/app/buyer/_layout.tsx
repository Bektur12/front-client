import { useState } from 'react'
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui'
import { CenterActionButton, TabBarContainer, TabButton } from '@/components/tab-bar'
import { QuickActionsSheet } from '@/components/quick-actions'
import { PlusThinIcon } from '@/components/buyer-v23'
import { useUnread } from '@/api/chats'
import { ChatIcon, HomeIcon, MarketIcon, ProfileIcon, SearchIcon } from '@/components/icons'
import { t } from '@/i18n'
import { useSignedIn } from '@/api/catalog'

/** Buyer tabs: Главная · Запчасти · Рынок (карта) · Чаты · Профиль; «＋» висит над «Рынком» — найти запчасть, мастер, «сломалась машина». */
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
				<TabTrigger name="market" asChild>
					<TabButton icon={MarketIcon} label={t('Рынок')} underAction />
				</TabTrigger>
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

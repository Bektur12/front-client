import { ChatList } from '@/components/chat-list'
import { SignInPrompt } from '@/components/sign-in-prompt'
import { ChatIcon } from '@/components/icons'
import { useSignedIn } from '@/api/catalog'
import { t } from '@/i18n'

/** 16 «Чаты» — buyer. A guest sees what chats are for and «Войти». */
export default function BuyerChatsScreen() {
	const signedIn = useSignedIn()
	if (!signedIn) {
		return (
			<SignInPrompt
				icon={ChatIcon}
				title={t('Чаты с продавцами')}
				text={t('Войдите по номеру телефона, чтобы писать продавцам и мастерам и получать ответы на запросы.')}
			/>
		)
	}
	return <ChatList as="BUYER" />
}

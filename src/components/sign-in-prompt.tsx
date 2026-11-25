import type { ComponentType } from 'react'
import { Alert, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '@/components/ui'
import type { IconProps } from '@/components/icons'
import { fontFamily, fs, useColors } from '@/theme'
import { useSession } from '@/store/useSession'
import { t } from '@/i18n'

/**
 * The phone sign-in screen, opened from inside the app — «Не сейчас» brings the guest back. `login=1` marks a
 * request to sign in: without it the start route is the app launch and goes straight to the catalog.
 */
export function openSignIn() {
	router.push({ pathname: '/', params: { login: '1' } })
}

/**
 * A guest browses freely (App Store 5.1.1(v)); an action tied to an account — a request, a chat, favourites —
 * asks to sign in first. Returns true when signed in and the action can go on.
 */
export function requireSignIn(why = t('Чтобы отправить запрос продавцам, войдите по номеру телефона.')) {
	if (useSession.getState().status === 'authed') return true
	Alert.alert(t('Нужно войти'), why, [
		{ text: t('Отмена'), style: 'cancel' },
		{ text: t('Войти'), onPress: openSignIn },
	])
	return false
}

/** A tab that only makes sense with an account (Чаты, Профиль) — for a guest, what it is and «Войти». */
export function SignInPrompt({ icon: Icon, title, text }: { icon?: ComponentType<IconProps>; title: string; text: string }) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	return (
		<View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top, paddingHorizontal: 24, justifyContent: 'center', gap: 14 }}>
			{Icon ? (
				<View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.brandTint, alignItems: 'center', justifyContent: 'center' }}>
					<Icon size={30} color={c.brandStrong} />
				</View>
			) : null}
			<Text style={{ fontSize: fs.h2, fontFamily: fontFamily(800), color: c.ink }}>{title}</Text>
			<Text style={{ fontSize: fs.lg, lineHeight: 24, fontFamily: fontFamily(400), color: c.inkSecondary }}>{text}</Text>
			<Button label={t('Войти по номеру телефона')} onPress={openSignIn} />
		</View>
	)
}

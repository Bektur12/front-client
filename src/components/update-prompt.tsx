import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Modal, Platform, Text, View } from 'react-native'
import Constants from 'expo-constants'
import { Button } from '@/components/ui'
import { fontFamily, fs, useColors } from '@/theme'
import { apiFetch } from '@/lib/api'
import { t } from '@/i18n'

/** GET /app/release — see AppReleaseDto on the backend. */
interface AppRelease {
	latestVersion: string | null
	storeUrl: string | null
	updateAvailable: boolean
	updateRequired: boolean
}

const VERSION = Constants.expoConfig?.version ?? null
const PLATFORM = Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : null

// «Позже» hides the window until the app is started again — not per screen, not per foreground.
let snoozedVersion: string | null = null

/**
 * «Обновите приложение»: a new version is in the store — on launch and on coming back to the app. Below the
 * minimum version (updateRequired) there is no «Позже»: the old app would break against the server.
 */
export function UpdatePrompt() {
	const c = useColors()
	const [release, setRelease] = useState<AppRelease | null>(null)

	const check = useCallback(() => {
		if (!VERSION || !PLATFORM) return
		apiFetch<AppRelease>('/app/release', { query: { platform: PLATFORM, version: VERSION }, auth: false })
			.then(setRelease)
			.catch(() => {})
	}, [])

	useEffect(() => {
		check()
		const subscription = AppState.addEventListener('change', (state) => state === 'active' && check())
		return () => subscription.remove()
	}, [check])

	const [, rerender] = useState(0)
	if (!release?.updateAvailable || !release.storeUrl) return null
	if (!release.updateRequired && snoozedVersion === release.latestVersion) return null

	const later = () => {
		snoozedVersion = release.latestVersion
		rerender((n) => n + 1)
	}

	return (
		<Modal transparent animationType="fade" statusBarTranslucent onRequestClose={release.updateRequired ? () => {} : later}>
			<View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
				<View style={{ alignSelf: 'stretch', maxWidth: 420, borderRadius: 20, backgroundColor: c.surface, padding: 24, gap: 12 }}>
					<Text style={{ fontSize: fs.h3, fontFamily: fontFamily(800), color: c.ink, textAlign: 'center' }}>
						{release.updateRequired ? t('Обновите приложение') : t('Доступно обновление')}
					</Text>
					<Text style={{ fontSize: fs.base, lineHeight: 23, fontFamily: fontFamily(400), color: c.inkSecondary, textAlign: 'center' }}>
						{release.updateRequired
							? t('Эта версия больше не поддерживается. Обновите KUDAIBERDI, чтобы продолжить.')
							: t('Вышла версия {0} — с исправлениями и новыми возможностями.', release.latestVersion ?? '')}
					</Text>
					<View style={{ gap: 8, marginTop: 8 }}>
						<Button label={t('Обновить')} onPress={() => release.storeUrl && Linking.openURL(release.storeUrl).catch(() => {})} />
						{release.updateRequired ? null : <Button label={t('Позже')} variant="outline" onPress={later} />}
					</View>
				</View>
			</View>
		</Modal>
	)
}

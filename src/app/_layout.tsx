import '../global.css'
import { useCallback, useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { setAudioModeAsync } from 'expo-audio'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import {
	Inter_300Light,
	Inter_400Regular,
	Inter_500Medium,
	Inter_600SemiBold,
	Inter_700Bold,
	Inter_800ExtraBold,
	useFonts,
} from '@expo-google-fonts/inter'
import { persistOptions, queryClient } from '@/lib/query-client'
import { RealtimeProvider } from '@/lib/realtime'
import { PushProvider } from '@/lib/push'
import { useDictionariesVersion } from '@/lib/dictionaries'
import { useSession } from '@/store/useSession'
import { useColors } from '@/theme'
import { ToastHost } from '@/components/ui/toast'
import { PushPrimer } from '@/components/push-primer'
import { KeyboardDoneBar } from '@/components/keyboard-done'
import { IntroSplash } from '@/components/intro-splash'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
	const [fontsLoaded] = useFonts({
		Inter_300Light,
		Inter_400Regular,
		Inter_500Medium,
		Inter_600SemiBold,
		Inter_700Bold,
		Inter_800ExtraBold,
	})

	// Follows the phone's light / dark setting (app.json: userInterfaceStyle automatic).
	const c = useColors()
	const booting = useSession((s) => s.status === 'booting')
	// A language change remounts the screens — every text is read again in the new language.
	const lang = useSession((s) => s.lang)

	useEffect(() => {
		useSession.getState().boot()
		// Voice notes play even with the iPhone's silent switch on — otherwise they are mute until the first recording.
		setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {})
	}, [])
	useDictionariesVersion()

	const ready = fontsLoaded && !booting
	// The moving logo on launch — once, right after the native splash.
	const [intro, setIntro] = useState(true)
	const endIntro = useCallback(() => setIntro(false), [])

	useEffect(() => {
		if (ready) SplashScreen.hideAsync()
	}, [ready])

	if (!ready) return null

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
				<RealtimeProvider>
					<PushProvider>
						<SafeAreaProvider>
							<StatusBar style="auto" />
							<Stack
								key={lang}
								screenOptions={{
									headerShown: false,
									contentStyle: { backgroundColor: c.surface },
								}}
							>
								{/* Set here, not from the screen: options from the screen are re-applied on every render and iOS re-presents the modal. */}
								<Stack.Screen name="master-answer" options={{ presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }} />
							</Stack>
							<KeyboardDoneBar />
							{intro ? <IntroSplash onDone={endIntro} /> : null}
							<PushPrimer />
							<ToastHost />
						</SafeAreaProvider>
					</PushProvider>
				</RealtimeProvider>
			</PersistQueryClientProvider>
		</GestureHandlerRootView>
	)
}

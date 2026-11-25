import { Platform } from 'react-native'
import { requireOptionalNativeModule } from 'expo'

/**
 * Live Activity продавца (iPhone, iOS 17.2+). Нативного модуля нет (Android, веб, старая сборка) — всё
 * молча ничего не делает, приложение работает как раньше с обычными пушами.
 */
interface Subscription {
	remove(): void
}

interface NativeModule {
	isSupported(): boolean
	end(requestId: number): Promise<void>
	addListener(event: 'onPushToStartToken', listener: (event: { token: string }) => void): Subscription
}

/** Мост работает только вместе с виджетом RequestLiveActivity (плагин @bacons/apple-targets в app.json). Убрали виджет из сборки — ставьте false: без него токен отдавать нельзя, иначе продавец не увидит запрос. */
const ENABLED = true

const native = ENABLED && Platform.OS === 'ios' ? requireOptionalNativeModule<NativeModule>('KudaiberdiLiveActivity') : null

export const liveActivity = {
	isSupported: () => Boolean(native?.isSupported()),
	/** Push-to-start токен: приходит при запуске и меняется сам — каждый раз отдать бэкенду. */
	onStartToken: (listener: (token: string) => void) => native?.addListener('onPushToStartToken', (event) => listener(event.token)),
	/** Закрыть карточку запроса, на который уже ответили. */
	end: (requestId: number) => native?.end(requestId).catch(() => {}),
}

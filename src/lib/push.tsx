// Push notifications (FCM on the backend). Registers the device after sign-in,
// routes taps by `data.type`, and answers «Есть + цена» / «Нет» / «Не моё» straight from the NEW_REQUEST /
// NEW_SERVICE_REQUEST push [12].

import { type ReactNode, useEffect } from 'react'
import { Linking, Platform } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications'
import { create } from 'zustand'
import { router } from 'expo-router'
import { apiFetch } from '@/lib/api'
import { getItem, setItem } from '@/lib/secure-storage'
import { queryClient } from '@/lib/query-client'
import { refreshIncoming } from '@/lib/realtime'
import { useSession } from '@/store/useSession'
import { chatKeys, deliveryKeys, incomingKeys, masterKeys, shopKeys } from '@/api/keys'
import type { Chat, Me } from '@/api/types'
import { t } from '@/i18n'

const TOKEN_KEY = 'push.token'

/** Payload the backend puts into `data` (all values are strings). */
interface PushData {
	type?: string
	requestId?: string
	chatId?: string
	partId?: string
	shopId?: string
	/** ACCOUNT_STATUS: `SHOP` / `MASTER`, `event` APPROVED / REJECTED / BLOCKED / UNBLOCKED. */
	target?: string
	event?: string
	/** DISPUTE_RESOLVED: «true» / «false». */
	won?: string
	/** NEW_REQUEST [12]: the buyer's voice note and the first photo. */
	voiceUrl?: string
	voiceDurationSec?: string
	photoUrl?: string
	/** DELIVERY_ORDER (and the buyer's delivery statuses): the order to open. */
	deliveryOrderId?: string
	/** REPLY_HAVE: the seller's container — «Как пройти» straight from the push. */
	containerId?: string
	shopName?: string
}

// Expo Go has no device push tokens (Android since SDK 53) — push works in the dev / release build.
const pushAvailable = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient

if (Platform.OS !== 'web') {
	Notifications.setNotificationHandler({
		handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
	})
	// Android channels — ids match the backend (FcmPushSender). MAX importance: the push pops up over the screen,
	// big, with its buttons, instead of sliding quietly into the shade.
	if (Platform.OS === 'android') {
		const loud = { importance: AndroidImportance.MAX, vibrationPattern: [0, 250, 150, 250], lockscreenVisibility: AndroidNotificationVisibility.PUBLIC }
		Notifications.setNotificationChannelAsync('requests', { name: t('Новые запросы'), sound: 'default', ...loud }).catch(() => {})
		Notifications.setNotificationChannelAsync('requests_silent', { name: t('Новые запросы без звука'), importance: AndroidImportance.HIGH, sound: null, lockscreenVisibility: AndroidNotificationVisibility.PUBLIC }).catch(() => {})
		Notifications.setNotificationChannelAsync('important', { name: t('Ответы и сообщения'), sound: 'default', ...loud }).catch(() => {})
	}
	// «Есть / Нет» on a new request [12] — the app isn't opened: «Есть» asks for the price right in the notification.
	Notifications.setNotificationCategoryAsync('NEW_REQUEST', [
		{
			identifier: 'HAVE',
			buttonTitle: t('Есть'),
			textInput: { submitButtonTitle: t('Отправить'), placeholder: t('Цена, сом') },
			options: { opensAppToForeground: false },
		},
		{ identifier: 'NOT_HAVE', buttonTitle: t('Нет'), options: { opensAppToForeground: false } },
		{ identifier: 'VOICE', buttonTitle: t('Ответить голосом'), options: { opensAppToForeground: true } },
	]).catch(() => {})
	// «Есть» to the buyer: go to the seller at once — write or walk there.
	Notifications.setNotificationCategoryAsync('REPLY_HAVE', [
		{ identifier: 'WRITE', buttonTitle: t('Написать'), options: { opensAppToForeground: true } },
		{ identifier: 'ROUTE', buttonTitle: t('Как пройти'), options: { opensAppToForeground: true } },
	]).catch(() => {})
	// «Могу помочь / Не моё» on a new service request [39]: «Не моё» answers in the background.
	// «Ответить голосом» on both opens the answer screen with the recording already running.
	Notifications.setNotificationCategoryAsync('NEW_SERVICE_REQUEST', [
		{ identifier: 'CAN_HELP', buttonTitle: t('Могу помочь'), options: { opensAppToForeground: true } },
		{ identifier: 'NOT_MINE', buttonTitle: t('Не моё'), options: { opensAppToForeground: false } },
		{ identifier: 'VOICE', buttonTitle: t('Ответить голосом'), options: { opensAppToForeground: true } },
	]).catch(() => {})
}

/**
 * Device token → POST /devices. Android: the FCM token; iOS: see BACKEND_QUESTIONS.md (APNs).
 * `ask` — show the system prompt; without it only an already granted permission registers (at sign-in).
 */
async function registerDevice({ ask = false } = {}) {
	if (!pushAvailable) return
	const permission = ask ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync()
	if (!permission.granted) return
	const { data: token } = await Notifications.getDevicePushTokenAsync()
	if (typeof token !== 'string' || !token) return
	// actions: это приложение само рисует пуши с кнопками («Есть / Нет», «Написать / Как пройти») — сервер шлёт их только
	// таким устройствам; старым версиям на Android уходит обычный пуш
	await apiFetch('/devices', { method: 'POST', body: { token, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', actions: true } })
	await setItem(TOKEN_KEY, token)
}

// ─── Asking at the moment it's worth it ───────────────────────────────────────
// Not the system prompt right after sign-in (most say «no» to a cold prompt, and the app lives on «продавцы
// ответили»): our own sheet when the value is obvious — a request just sent, a box just opened — then the system one.

export type PushMoment = 'request' | 'service' | 'shop' | 'master'

const SNOOZE_KEY = 'push.primer.snoozed'
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000

interface PushPrimerState {
	moment: PushMoment | null
	/** Turned off earlier and the system won't ask again — the sheet offers the settings instead. */
	denied: boolean
}

export const usePushPrimer = create<PushPrimerState>(() => ({ moment: null, denied: false }))

/** Call after the action that makes pushes worth it. Shows the sheet unless already allowed or snoozed. */
export async function askForPushAt(moment: PushMoment) {
	if (!pushAvailable) return
	const permission = await Notifications.getPermissionsAsync().catch(() => null)
	if (!permission) return
	if (permission.granted) return registerDevice().catch(() => {})
	const snoozed = Number(await getItem(SNOOZE_KEY))
	if (snoozed && Date.now() - snoozed < SNOOZE_MS) return
	usePushPrimer.setState({ moment, denied: !permission.canAskAgain })
}

/** «Разрешить» on the sheet: the system prompt, or the settings when it can't be shown any more. */
export async function allowPush() {
	const { denied } = usePushPrimer.getState()
	usePushPrimer.setState({ moment: null })
	if (denied) return Linking.openSettings()
	await registerDevice({ ask: true }).catch(() => {})
}

/** «Не сейчас» — the sheet comes back at the next good moment, not before 3 days. */
export function snoozePush() {
	usePushPrimer.setState({ moment: null })
	setItem(SNOOZE_KEY, String(Date.now())).catch(() => {})
}

/** On sign-out: the device stops getting this user's pushes. */
export async function unregisterDevice() {
	const token = await getItem(TOKEN_KEY)
	if (!token) return
	await apiFetch(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' }).catch(() => {})
	await setItem(TOKEN_KEY, null)
}

/** Where a push leads (contract, section 1). */
async function openPush(data: PushData) {
	const requestId = data.requestId ?? ''
	// «Новый заказ с доставкой» to the shop, «Курьер забрал посылку» to the buyer — the order's screen decides the side.
	if (data.deliveryOrderId && data.type?.startsWith('DELIVERY')) {
		return router.push({ pathname: '/delivery-order', params: { id: data.deliveryOrderId } })
	}
	switch (data.type) {
		case 'NEW_REQUEST':
			return router.push({ pathname: '/seller-answer', params: { id: requestId } })
		case 'REPLY_HAVE':
			return router.push({ pathname: '/request', params: { id: requestId } })
		case 'NO_REPLY':
		case 'REQUEST_EXPIRED':
			return router.push({ pathname: '/request', params: { id: requestId } })
		case 'SALE':
			return router.push('/seller')
		case 'PRICE_DROP':
		case 'OUT_OF_STOCK':
			return router.push({ pathname: '/part', params: { id: data.partId ?? '' } })
		case 'NEW_SERVICE_REQUEST':
		case 'SERVICE_DEAL':
			return router.push('/master')
		case 'SERVICE_OFFER':
		case 'SERVICE_NO_OFFERS':
		case 'SERVICE_EXPIRED':
			return router.push({ pathname: '/service-offers', params: { id: requestId } })
		// Administration [contract §1]: the account status changed — refresh the session and open the profile.
		case 'ACCOUNT_STATUS': {
			const me = await apiFetch<Me>('/me').catch(() => null)
			if (me) useSession.getState().setUser(me)
			queryClient.invalidateQueries({ queryKey: data.target === 'MASTER' ? masterKeys.profile : shopKeys.my })
			return router.push(data.target === 'MASTER' ? '/master/profile' : '/seller/box')
		}
		// A container dispute: won — the box is yours now; lost — pick another one.
		case 'DISPUTE_RESOLVED':
			queryClient.invalidateQueries({ queryKey: shopKeys.my })
			return router.push(data.won === 'true' ? '/seller/box' : '/box-select')
		// The text is the push itself; nothing to open — just bring the app to its home.
		case 'ADMIN_MESSAGE':
		case 'COMPLAINT_RESOLVED':
			return
		case 'CHAT_MESSAGE': {
			// The payload has no side — the chat itself says whether I am the buyer or the box.
			const chatId = Number(data.chatId)
			const chat = await queryClient
				.fetchQuery({ queryKey: chatKeys.detail(chatId), queryFn: () => apiFetch<Chat>(`/chats/${chatId}`) })
				.catch(() => null)
			return router.push({
				pathname: chat?.mySide === 'SHOP' ? '/seller-chat' : '/chat',
				params: { chatId: String(chatId) },
			})
		}
	}
}

/** «3 200», «3200 сом» typed into the push → 3200; no digits — null. */
function typedPrice(text: string | undefined) {
	const digits = (text ?? '').replace(/\D/g, '')
	const price = Number(digits)
	return digits && price > 0 ? price : null
}

/** Each tap is handled once: the listener and the cold-start check can both see the same one. */
const handledTaps = new Set<string>()
/** The tap that cold-started the app is looked at once per launch — not again after every sign-in. */
let coldStartChecked = false

async function handleResponse(response: Notifications.NotificationResponse) {
	const id = `${response.notification.request.identifier}:${response.actionIdentifier}`
	if (handledTaps.has(id)) return
	handledTaps.add(id)
	const data = (response.notification.request.content.data ?? {}) as PushData
	if (response.actionIdentifier === 'HAVE' && data.requestId) {
		const price = typedPrice(response.userText)
		try {
			if (price === null) throw new Error('PRICE_REQUIRED')
			await apiFetch(`/requests/${data.requestId}/replies`, {
				method: 'POST',
				body: { answer: 'HAVE', price },
				idempotencyKey: `push-${response.notification.request.identifier}`,
			})
		} catch {
			// The action runs in the background — a tap on this reminder finishes the answer in the app [14].
			await Notifications.scheduleNotificationAsync({
				content: {
					title: t('Ответ не отправлен'),
					body: price === null ? t('«Есть» — только с ценой. Нажмите, чтобы ответить') : t('Нажмите, чтобы ответить в приложении'),
					data: { type: 'NEW_REQUEST', requestId: data.requestId },
				},
				trigger: null,
			}).catch(() => {})
			return
		}
		queryClient.invalidateQueries({ queryKey: incomingKeys.all })
		return
	}
	if (response.actionIdentifier === 'NOT_HAVE' && data.requestId) {
		await apiFetch(`/requests/${data.requestId}/replies`, {
			method: 'POST',
			body: { answer: 'NOT_HAVE' },
			idempotencyKey: `push-${response.notification.request.identifier}`,
		}).catch(() => {})
		return
	}
	if (response.actionIdentifier === 'NOT_MINE' && data.requestId) {
		await apiFetch(`/my/master/requests/${data.requestId}/offer`, {
			method: 'POST',
			body: { answer: 'NOT_MINE' },
			idempotencyKey: `push-${response.notification.request.identifier}`,
		}).catch(() => {})
		return
	}
	if (response.actionIdentifier === 'WRITE' && data.shopId) {
		const chat = await apiFetch<Chat>('/chats', {
			method: 'POST',
			body: { shopId: Number(data.shopId), requestId: data.requestId ? Number(data.requestId) : undefined },
		}).catch(() => null)
		return chat
			? router.push({ pathname: '/chat', params: { chatId: String(chat.id) } })
			: router.push({ pathname: '/request', params: { id: data.requestId ?? '' } })
	}
	if (response.actionIdentifier === 'ROUTE') {
		return data.containerId
			? router.push({ pathname: '/route', params: { containerId: data.containerId, shopName: data.shopName } })
			: router.push({ pathname: '/request', params: { id: data.requestId ?? '' } })
	}
	if (response.actionIdentifier === 'VOICE' && data.requestId) {
		return data.type === 'NEW_SERVICE_REQUEST'
			? router.push({ pathname: '/master-answer', params: { id: data.requestId, record: '1' } })
			: router.push({ pathname: '/seller-answer', params: { id: data.requestId, voice: '1' } })
	}
	await openPush(data)
}

/** Registers the device while signed in and handles taps (also the one that cold-started the app). */
export function PushProvider({ children }: { children: ReactNode }) {
	const signedIn = useSession((s) => s.status === 'authed')
	const userId = useSession((s) => s.userId)

	useEffect(() => {
		if (signedIn && userId !== null) registerDevice().catch(() => {})
	}, [signedIn, userId])

	useEffect(() => {
		if (!signedIn || Platform.OS === 'web') return
		// The OS keeps the last tapped push across launches; without clearing it every sign-in reopened that old chat.
		if (!coldStartChecked) {
			coldStartChecked = true
			Notifications.getLastNotificationResponseAsync()
				.then((response) => response && handleResponse(response))
				.catch(() => {})
				.finally(() => Notifications.clearLastNotificationResponse())
		}
		const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
			handleResponse(response).catch(() => {})
		})
		// A push while the app is open: the banner shows, but the lists on screen must refresh too —
		// before, a new request appeared only after the app was closed and reopened.
		const received = Notifications.addNotificationReceivedListener((notification) => {
			const data = (notification.request.content.data ?? {}) as PushData
			refreshIncoming(data.type)
			if (data.type === 'CHAT_MESSAGE') queryClient.invalidateQueries({ queryKey: chatKeys.list })
			if (data.type?.startsWith('DELIVERY')) queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
		})
		return () => {
			subscription.remove()
			received.remove()
		}
	}, [signedIn])

	return children
}

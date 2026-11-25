import { useMemo, useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import { BackIcon, BigButton } from '@/components/buyer-v23'
import { formatKgPhone } from '@/components/video-v23'
import { Image } from '@/components/ui/image'
import { CloseIcon, WhatsAppIcon } from '@/components/icons'
import { KEYBOARD_DONE } from '@/components/keyboard-done'
import { useMarketScheme } from '@/api/market'
import { useDeliveryTariffs } from '@/api/delivery'
import { useMe } from '@/api/me'
import type { DeliveryRegionCode } from '@/api/types'
import { findContainer } from '@/lib/market-search'
import { schemaToGeo } from '@/lib/geo'
import { currentCoords } from '@/lib/locate'
import { shopPlace } from '@/lib/shop-place'
import { openYandexGo, type Point } from '@/lib/yandex-go'
import { fixed, fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

type Shop = Parameters<typeof shopPlace>[0]

/**
 * «Вызвать курьера» из чата с продавцом — на выбор:
 *  • Яндекс Go — по Бишкеку прямо сейчас: приложение с маршрутом от контейнера продавца до покупателя;
 *  • Ылдам Экспресс — по регионам: регион, адрес, получатель → WhatsApp Ылдам с готовой заявкой.
 * Оба заказа живут у службы доставки, не на нашем сервере (у чата нет товара для /delivery-orders).
 */
export function CourierSheet({ shop, onClose }: { shop: Shop; onClose: () => void }) {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const [step, setStep] = useState<'choose' | 'yldam'>('choose')

	return (
		<Modal visible transparent animationType="slide" onRequestClose={onClose}>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
				<Pressable accessibilityLabel={t('Закрыть')} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} />
				<View
					style={{
						maxHeight: '88%',
						backgroundColor: c.surface,
						borderTopLeftRadius: 24,
						borderTopRightRadius: 24,
						paddingTop: 16,
						paddingBottom: insets.bottom + 12,
					}}
				>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 }}>
						{step === 'yldam' ? (
							<Pressable accessibilityLabel={t('Назад')} onPress={() => setStep('choose')} hitSlop={8}>
								<BackIcon color={c.ink} />
							</Pressable>
						) : null}
						<Text style={{ flex: 1, fontSize: fs.xl, fontFamily: fontFamily(800), color: c.ink }}>
							{step === 'yldam' ? t('Куда отправить') : t('Как доставить?')}
						</Text>
						<Pressable accessibilityLabel={t('Закрыть')} onPress={onClose} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
							<CloseIcon size={16} color={c.ink} />
						</Pressable>
					</View>

					{step === 'choose' ? <Choose shop={shop} onYldam={() => setStep('yldam')} onDone={onClose} /> : <YldamForm shop={shop} onDone={onClose} />}
				</View>
			</KeyboardAvoidingView>
		</Modal>
	)
}

// ─── Выбор службы ────────────────────────────────────────────────────────────

function Choose({ shop, onYldam, onDone }: { shop: Shop; onYldam: () => void; onDone: () => void }) {
	const tariffs = useDeliveryTariffs().data
	const { opening, call } = useYandexCourier(shop)
	const yldamName = tariffs?.courierName ?? t('Ылдам Экспресс')
	const yandex = () => call().then(onDone)

	return (
		<View style={{ paddingHorizontal: 16, gap: 10 }}>
			<Option logo={YANDEX_LOGO} title={t('Вызвать Яндекс курьера')} sub={opening ? t('Открываем…') : t('По Бишкеку — привезёт сегодня')} loading={opening} onPress={yandex} />
			<Option logo={YLDAM_LOGO} title={t('Вызвать {0}', yldamName)} sub={tariffs?.courierPhone ? t('В регионы — заявка в WhatsApp') : t('Сейчас недоступно')} disabled={!tariffs?.courierPhone} onPress={onYldam} />
		</View>
	)
}

/**
 * «Яндекс курьер»: Яндекс Go с маршрутом от контейнера продавца (или адреса магазина) до того места, где покупатель сейчас.
 * Нет разрешения или GPS — адрес «куда» введут в самом Яндекс Go.
 */
export function useYandexCourier(shop: Shop | null | undefined) {
	const scheme = useMarketScheme().data
	const [opening, setOpening] = useState(false)

	const pickup = useMemo<Point | null>(() => {
		if (!shop) return null
		const found = shop.location ? findContainer(scheme, shop.location.containerId) : null
		if (found) {
			const [lon, lat] = schemaToGeo(found.container.x, found.container.y)
			return { lat, lon }
		}
		return shop.lat != null && shop.lng != null ? { lat: shop.lat, lon: shop.lng } : null
	}, [scheme, shop])

	const call = async () => {
		if (opening) return
		setOpening(true)
		try {
			let destination: Point | null = null
			try {
				const permission = await Location.requestForegroundPermissionsAsync()
				if (permission.granted) {
					const coords = await currentCoords()
					destination = { lat: coords.latitude, lon: coords.longitude }
				}
			} catch {}
			await openYandexGo(pickup, destination)
		} finally {
			setOpening(false)
		}
	}

	return { opening, call }
}

export const YANDEX_LOGO = require('../../assets/images/couriers/yandex-go.jpg')
export const YLDAM_LOGO = require('../../assets/images/couriers/yldam.jpg')

function Option({ logo, title, sub, onPress, loading, disabled }: { logo: number; title: string; sub: string; onPress: () => void; loading?: boolean; disabled?: boolean }) {
	return (
		// Pressable — только нажатие; раскладка во вложенном View: стиль-функция у Pressable здесь не применялась,
		// карточка разваливалась в столбик и текст получал нулевую высоту
		<Pressable onPress={onPress} disabled={disabled || loading}>
			<View
				style={{
					borderRadius: 16,
					// цвета без темы: белая карточка и тёмный текст видны и в светлой, и в тёмной теме
					backgroundColor: fixed.white,
					borderWidth: 1,
					borderColor: '#E4E2E0',
					padding: 12,
					flexDirection: 'row',
					alignItems: 'center',
					gap: 12,
					opacity: disabled ? 0.5 : 1,
				}}
			>
				<Image source={logo} contentFit="cover" style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: fixed.white }} />
				<View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
					<Text style={{ fontSize: fs.lg, fontFamily: fontFamily(800), color: fixed.inkOnLight }}>{title}</Text>
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: fixed.mutedOnLight }}>{sub}</Text>
				</View>
				<Text style={{ fontSize: fs.xl, color: fixed.mutedOnLight }}>›</Text>
			</View>
		</Pressable>
	)
}

// ─── Ылдам: регион, адрес, получатель → WhatsApp ─────────────────────────────

function YldamForm({ shop, onDone }: { shop: Shop; onDone: () => void }) {
	const c = useColors()
	const tariffs = useDeliveryTariffs().data
	const me = useMe().data
	const [regionCode, setRegionCode] = useState<DeliveryRegionCode | null>(null)
	const [address, setAddress] = useState('')
	const [name, setName] = useState<string | null>(null)
	const [phone, setPhone] = useState<string | null>(null)

	const regions = tariffs?.regions ?? []
	const region = regions.find((item) => item.code === regionCode)
	const recipient = name ?? me?.name ?? ''
	const recipientPhone = phone ?? formatKgPhone(me?.phone)
	const courierPhone = tariffs?.courierPhone
	const ready = Boolean(courierPhone && region && address.trim() && recipient.trim() && recipientPhone.replace(/\D/g, '').length >= 9)

	const send = () => {
		if (!ready || !region || !courierPhone) return
		const text = [
			t('Здравствуйте! Заявка на доставку из приложения KUDAIBERDI.'),
			'',
			t('Забрать: {0}', [shop.name, shopPlace(shop)].filter(Boolean).join(', ')),
			shop.phone ? t('Телефон продавца: {0}', shop.phone) : null,
			'',
			t('Куда: {0}, {1}', region.name, address.trim()),
			t('Получатель: {0}, {1}', recipient.trim(), recipientPhone.trim()),
		]
			.filter((part) => part !== null)
			.join('\n')
		Linking.openURL(`https://wa.me/${courierPhone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`)
		onDone()
	}

	const input = {
		height: 48,
		borderRadius: 12,
		borderWidth: 1.5,
		borderColor: c.border,
		backgroundColor: c.card,
		paddingHorizontal: 14,
		fontSize: fs.lg,
		fontFamily: fontFamily(500),
		color: c.ink,
	} as const

	return (
		<>
			<ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 10 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
				<Field label={t('Куда везти')}>
					<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
						{regions.map((item) => {
							const active = item.code === regionCode
							return (
								<Pressable
									key={item.code}
									onPress={() => setRegionCode(item.code)}
									style={{
										flexGrow: 1,
										flexBasis: '45%',
										minHeight: 48,
										borderRadius: 12,
										borderWidth: 2,
										borderColor: active ? c.brand : c.card,
										backgroundColor: active ? c.brandTint : c.card,
										paddingVertical: 6,
										paddingHorizontal: 12,
										justifyContent: 'center',
									}}
								>
									<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: active ? c.brandStrong : c.ink }}>{item.name}</Text>
									<Text style={{ fontSize: fs.xs, fontFamily: fontFamily(500), color: c.muted }}>{t('{0} дн.', item.days)}</Text>
								</Pressable>
							)
						})}
					</View>
				</Field>
				<Field label={region ? t('Адрес в {0}', region.inName) : t('Адрес')}>
					<TextInput inputAccessoryViewID={KEYBOARD_DONE} value={address} onChangeText={setAddress} placeholder={t('ул. Ленина 45, кв. 12')} placeholderTextColor={c.fillInk} style={input} textContentType="fullStreetAddress" autoComplete="street-address" />
				</Field>
				<View style={{ flexDirection: 'row', gap: 10 }}>
					<View style={{ flex: 1 }}>
						<Field label={t('Получатель')}>
							<TextInput inputAccessoryViewID={KEYBOARD_DONE} value={recipient} onChangeText={setName} placeholder={t('Имя')} placeholderTextColor={c.fillInk} style={input} textContentType="name" autoComplete="name" />
						</Field>
					</View>
					<View style={{ flex: 1.2 }}>
						<Field label={t('Телефон')}>
							<TextInput inputAccessoryViewID={KEYBOARD_DONE} value={recipientPhone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" placeholder="+996 555 123 456" placeholderTextColor={c.fillInk} style={input} />
						</Field>
					</View>
				</View>
			</ScrollView>
			<View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
				<BigButton
					label={t('Отправить заявку в WhatsApp')}
					height={54}
					disabled={!ready}
					onPress={send}
					icon={<WhatsAppIcon size={20} color={fixed.white} />}
				/>
			</View>
		</>
	)
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	const c = useColors()
	return (
		<View style={{ gap: 6 }}>
			<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.muted }}>{label}</Text>
			{children}
		</View>
	)
}

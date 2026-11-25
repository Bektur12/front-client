import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { askForPushAt } from '@/lib/push'
import { useConfirmLeave } from '@/lib/use-confirm-leave'
import { Image } from '@/components/ui/image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Location from 'expo-location'
import { addressAt, currentPosition } from '@/lib/locate'
import { BrandLogo, ServiceIcon } from '@/components/ui'
import { VoicePlayer, useVoiceNote, voiceClock } from '@/components/voice'
import { CameraOutline, CloseX, MicOutline, ModalSheet, PinOutline, SendPlane } from '@/components/master-v23'
import { fixed, fontFamily, fs, raw, sectionTitle, useColors } from '@/theme'
import { plural } from '@/lib/format'
import { useCars } from '@/api/garage'
import { useServiceMedia } from '@/api/media'
import { useCreateServiceRequest, useServiceEstimate } from '@/api/services'
import { MARKET_POINT } from '@/data/service-types'
import { useServiceDraft } from '@/store/useServiceDraft'
import { t } from '@/i18n'
import { KEYBOARD_DONE } from '@/components/keyboard-done'
import { goBack } from '@/lib/navigation'

/** The six tiles of the mockup, in its order. */
const SERVICES: { code: string; label: string }[] = [
	{ code: 'CAR_REPAIR', label: t('Ремонт') },
	{ code: 'TIRE_SERVICE', label: t('Шиномонтаж') },
	{ code: 'TOW_TRUCK', label: t('Эвакуатор') },
	{ code: 'AUTO_ELECTRIC', label: t('Автоэлектрик') },
	{ code: 'BODY_PAINT', label: t('Кузов') },
	{ code: 'LPG', label: t('ГБО') },
]
const MAX_MEDIA = 5

/** locatedAt — время GPS-фикса (мс), нет — точка выбрана вручную (рынок). */
type Point = { lat: number; lng: number; label: string; address?: string; locatedAt?: number }
type Found = { point: Point } | { error: string }

/** Где человек сейчас: адрес и время фикса. Без разрешения или при ошибке — причина, точка остаётся прежней. */
async function findPoint(): Promise<Found> {
	try {
		if (!(await Location.requestForegroundPermissionsAsync()).granted) {
			return { error: t('Разрешите доступ к геолокации в настройках') }
		}
		const { coords, timestamp } = await currentPosition()
		const address = await addressAt(coords)
		return {
			point: { lat: coords.latitude, lng: coords.longitude, label: address ?? t('Где я сейчас'), address: address ?? undefined, locatedAt: timestamp },
		}
	} catch {
		return { error: t('Не удалось определить место — попробуйте ещё раз') }
	}
}

/** 16 «Нужен мастер» — service, car, what happened (photo / voice / text) and where, on one screen. */
export default function ServiceNewScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const params = useLocalSearchParams<{ service?: string }>()
	// The home tiles [03] pass the service as a param (older code — through the draft).
	const [service, setService] = useState(() => params.service ?? useServiceDraft.getState().service ?? 'CAR_REPAIR')
	const cars = useCars()
	const [carId, setCarId] = useState<number | null>(null)
	const car = cars.data?.find((item) => item.id === carId) ?? cars.data?.[0] ?? null
	const [pickCar, setPickCar] = useState(false)
	const [description, setDescription] = useState('')
	const media = useServiceMedia(MAX_MEDIA)
	const voice = useVoiceNote('SERVICE', (result) => {
		// What was said becomes the text if nothing is typed — it is the request's caption anyway.
		const said = result.voice.transcript?.trim() ?? ''
		if (said) setDescription((current) => (current.trim() ? current : said.slice(0, 500)))
	})
	// где человек — определяем сами при открытии; не вышло — человек пишет адрес текстом
	const [point, setPoint] = useState<Point | null>(null)
	const [locating, setLocating] = useState(true)
	const [locateError, setLocateError] = useState<string | null>(null)
	/** Адрес текстом: геолокации нет или человек нажал «Изменить». */
	const [typing, setTyping] = useState(false)
	const [typed, setTyped] = useState('')
	const create = useCreateServiceRequest()
	// пока точки нет — считаем мастеров по городу (точка рынка — центр поиска, человеку не показываем)
	const near = point ?? MARKET_POINT
	const estimate = useServiceEstimate({ service, carId: car?.id ?? null, lat: near.lat, lng: near.lng, radiusKm: 5 })

	useEffect(() => {
		useServiceDraft.getState().reset()
	}, [])

	const recipients = estimate.data?.recipients
	const text = description.trim()
	// Something to go on: text, photos / videos or a voice note — no minimum length.
	const described = text.length > 0 || media.mediaIds.length > 0 || Boolean(voice.result)
	const leave = useConfirmLeave(described || media.uploading || voice.recording)
	const placed = typing ? typed.trim().length >= 3 : Boolean(point)
	const ready = Boolean(car) && described && !locating && placed && !media.uploading && !voice.uploading && !voice.recording && recipients !== 0

	const hint = !car
		? t('Добавьте машину — мастера смотрят марку')
		: recipients === 0
			? t('Рядом нет мастеров, которые берутся за это — попробуйте другую точку')
			: recipients !== undefined
					? t('Спросим {0} {1} рядом', recipients, plural(recipients, [t('мастера'), t('мастеров'), t('мастеров')]))
					: ''

	/** Нашли место — подставить; нет — поле для адреса и причина. */
	const applyFound = (found: Found) => {
		if ('point' in found) {
			setPoint(found.point)
			setTyping(false)
		} else {
			setLocateError(found.error)
			setTyping(true)
		}
		setLocating(false)
	}
	/** Адрес текстом → точка: геокодер телефона; не нашёл (или веб) — адрес уходит текстом, мастера ищем по городу. */
	const placeTyped = async (): Promise<Point | null> => {
		const address = typed.trim()
		if (address.length < 3) return null
		const [found] = await Location.geocodeAsync(`${address}, Бишкек`).catch(() => [] as Location.LocationGeocodedLocation[])
		const typedPoint = { lat: found?.latitude ?? MARKET_POINT.lat, lng: found?.longitude ?? MARKET_POINT.lng, label: address, address }
		setPoint(typedPoint)
		return typedPoint
	}
	const locate = () => {
		setLocating(true)
		setLocateError(null)
		findPoint().then(applyFound)
	}

	// при открытии — сразу геолокация, без выбора
	useEffect(() => {
		let alive = true
		findPoint().then((found) => alive && applyFound(found))
		return () => {
			alive = false
		}
	}, [])

	const send = async () => {
		if (!ready || !car) return
		// адрес текстом — точка по нему, даже если «Отправить» нажали, не закрыв клавиатуру
		const target: { lat: number; lng: number; address?: string } = (typing ? await placeTyped() : point) ?? near
		create.mutate(
			{
				service,
				carId: car.id,
				description: text || undefined,
				mediaIds: media.mediaIds,
				voiceMediaId: voice.result?.voice.id,
				lat: target.lat,
				lng: target.lng,
				address: target.address,
			},
			{
				onSuccess: (request) => {
					leave(() => router.replace({ pathname: '/service-offers', params: { id: String(request.id) } }))
					askForPushAt('service')
				},
			}
		)
	}

	const label = (value: string) => (
		<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{value}</Text>
	)

	return (
		<View style={{ flex: 1, backgroundColor: c.surface, paddingTop: insets.top }}>
			<View style={{ height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
				<Text style={{ flex: 1, fontSize: fs.h1, fontFamily: fontFamily(700), letterSpacing: -0.26, color: c.ink }}>{t('Нужен мастер')}</Text>
				<Pressable onPress={() => goBack()} hitSlop={10}>
					<CloseX size={24} color={c.ink} />
				</Pressable>
			</View>

			<ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag"
				contentContainerStyle={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 16, gap: 9 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{label(t('Какая услуга'))}
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
					{SERVICES.map((item) => {
						const selected = item.code === service
						return (
							<Pressable
								key={item.code}
								onPress={() => setService(item.code)}
								style={{
									width: '31.6%',
									flexGrow: 1,
									height: 78,
									borderRadius: 16,
									backgroundColor: selected ? c.brandTint : c.card,
									borderWidth: 2,
									borderColor: selected ? c.brand : c.card,
									alignItems: 'center',
									justifyContent: 'center',
									gap: 7,
									paddingHorizontal: 4,
								}}
							>
								<View
									style={{
										width: 38,
										height: 38,
										borderRadius: 12,
										backgroundColor: selected ? c.brand : c.brandTint,
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<ServiceIcon code={item.code} size={22} color={selected ? fixed.white : c.brandStrong} />
								</View>
								<Text
									numberOfLines={1}
									style={{ fontSize: fs.sm, lineHeight: 16, fontFamily: fontFamily(selected ? 700 : 600), color: selected ? c.brandStrong : c.ink }}
								>
									{item.label}
								</Text>
							</Pressable>
						)
					})}
				</View>

				{label(t('Машина'))}
				<View style={{ flexDirection: 'row' }}>
					{car ? (
						<Pressable
							onPress={() => setPickCar(true)}
							style={{
								height: 40,
								paddingLeft: 6,
								paddingRight: 14,
								borderRadius: 20,
								backgroundColor: c.brandTint,
								borderWidth: 2,
								borderColor: c.brand,
								flexDirection: 'row',
								alignItems: 'center',
								gap: 8,
							}}
						>
							<BrandLogo brand={car.brand} size={28} />
							<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}>{car.label}</Text>
						</Pressable>
					) : cars.isSuccess ? (
						<Pressable
							onPress={() => router.push('/garage-add')}
							style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: raw.mapRowBorder, justifyContent: 'center' }}
						>
							<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('+ Добавить машину')}</Text>
						</Pressable>
					) : (
						<View style={{ height: 40 }} />
					)}
				</View>

				{label(t('Что случилось'))}
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
					<Pressable
						onPress={media.pick}
						disabled={!media.canAdd}
						style={{
							flex: 1,
							height: 92,
							borderRadius: 16,
							backgroundColor: c.card,
							borderWidth: 2,
							borderStyle: 'dashed',
							borderColor: raw.mapRowBorder,
							alignItems: 'center',
							justifyContent: 'center',
							gap: 6,
						}}
					>
						<CameraOutline size={26} color={c.brandStrong} />
						<Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.ink }}>
							{media.items.length ? t('Фото / видео · {0}', media.items.length) : t('Фото / видео')}
						</Text>
					</Pressable>
					<View style={{ flex: 1, height: 92, borderRadius: 16, backgroundColor: c.card, justifyContent: 'center', gap: 6, paddingHorizontal: 10 }}>
						<View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
							<Text style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: voice.recording ? c.danger : c.success }}>
								{voice.recording ? t('Говорите…') : t('Голосом')}
							</Text>
							{voice.result && !voice.recording ? (
								<Text onPress={voice.start} style={{ fontSize: fs.sm, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('Заново')}</Text>
							) : null}
						</View>
						{voice.result && !voice.recording ? (
							<VoicePlayer voice={voice.result.voice} />
						) : (
							<Pressable
								onPress={voice.recording ? voice.stop : voice.start}
								disabled={voice.uploading}
								style={{
									height: 44,
									borderRadius: 22,
									backgroundColor: c.surface,
									flexDirection: 'row',
									alignItems: 'center',
									gap: 8,
									paddingLeft: 6,
									paddingRight: 14,
								}}
							>
								<View
									style={{
										width: 32,
										height: 32,
										borderRadius: 16,
										backgroundColor: voice.recording ? c.danger : c.brand,
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									{voice.recording ? (
										<View style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: fixed.white }} />
									) : (
										<MicOutline size={16} color={fixed.white} />
									)}
								</View>
								<Text style={{ flex: 1, fontSize: fs.sm, fontFamily: fontFamily(600), color: c.muted }}>
									{voice.uploading ? t('Загружаем…') : voice.recording ? t('{0} · стоп', voiceClock(voice.seconds)) : t('Записать')}
								</Text>
							</Pressable>
						)}
					</View>
				</View>
				{media.items.length ? (
					<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
						{media.items.map((item) => (
							<Pressable
								key={item.key}
								onPress={() => (item.status === 'error' ? media.retry(item.key) : media.remove(item.key))}
								style={{
									width: 56,
									height: 56,
									borderRadius: 12,
									overflow: 'hidden',
									backgroundColor: fixed.media,
									opacity: item.status === 'uploading' ? 0.5 : 1,
									borderWidth: item.status === 'error' ? 2 : 0,
									borderColor: c.danger,
									alignItems: 'center',
									justifyContent: 'center',
								}}
							>
								{item.previewUri ? <Image source={{ uri: item.previewUri }} style={{ position: 'absolute', width: 56, height: 56 }} /> : null}
								{item.kind === 'VIDEO' ? <Text style={{ fontSize: fs.xs, color: fixed.white }}>▶</Text> : null}
							</Pressable>
						))}
					</View>
				) : null}
				{voice.error ? <Text style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.danger }}>{voice.error}</Text> : null}

				<TextInput inputAccessoryViewID={KEYBOARD_DONE}
					value={description}
					onChangeText={(value) => setDescription(value.slice(0, 500))}
					placeholder={t('Например: стучит спереди справа на кочках')}
					placeholderTextColor={c.fillInk}
					multiline
					style={{
						minHeight: 48,
						borderRadius: 14,
						backgroundColor: c.card,
						borderWidth: 2,
						borderColor: c.border,
						paddingHorizontal: 14,
						paddingTop: 13,
						paddingBottom: 11,
						fontSize: fs.base,
						fontFamily: fontFamily(400),
						color: c.ink,
					}}
				/>

				{typing ? (
					<View style={{ gap: 6 }}>
						<View style={{ height: 48, borderRadius: 14, backgroundColor: c.card, borderWidth: 2, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
							<PinOutline size={20} color={c.brandStrong} />
							<TextInput
								inputAccessoryViewID={KEYBOARD_DONE}
								value={typed}
								onChangeText={(value) => setTyped(value.slice(0, 120))}
								onEndEditing={placeTyped}
								onSubmitEditing={placeTyped}
								autoFocus={Boolean(point)}
								placeholder={t('Где вы: улица, дом')}
								placeholderTextColor={c.fillInk}
								returnKeyType="done"
								style={{ flex: 1, fontSize: fs.base, fontFamily: fontFamily(400), color: c.ink, padding: 0 }}
							/>
							<Text onPress={locate} style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}>
								{locating ? t('Ищем…') : t('Найти меня')}
							</Text>
						</View>
						{locateError ? <Text style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.muted }}>{locateError}</Text> : null}
					</View>
				) : (
					<View style={{ height: 48, borderRadius: 14, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 }}>
						<PinOutline size={20} color={c.brandStrong} />
						<Text numberOfLines={1} style={{ flex: 1, fontSize: fs.base, fontFamily: fontFamily(400), color: c.ink }}>
							{locating ? t('Определяем, где вы…') : point?.label}
						</Text>
						{locating ? null : (
							<Text onPress={() => (setTyped(point?.address ?? ''), setTyping(true))} style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}>
								{t('Изменить')}
							</Text>
						)}
					</View>
				)}
			</ScrollView>

			<View
				style={{
					paddingTop: 12,
					paddingHorizontal: 16,
					paddingBottom: 28 + insets.bottom,
					backgroundColor: c.card,
					borderTopWidth: 1,
					borderTopColor: c.hairline,
					gap: 10,
				}}
			>
				{create.error ? (
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.danger, textAlign: 'center' }}>{create.error.message}</Text>
				) : (
					<Text style={{ fontSize: fs.md, lineHeight: 19, fontFamily: fontFamily(400), color: c.muted, textAlign: 'center' }}>{hint}</Text>
				)}
				<Pressable
					onPress={send}
					disabled={!ready || create.isPending}
					style={{
						height: 56,
						borderRadius: 14,
						backgroundColor: c.brand,
						flexDirection: 'row',
						alignItems: 'center',
						justifyContent: 'center',
						gap: 8,
						opacity: ready && !create.isPending ? 1 : 0.5,
					}}
				>
					<SendPlane size={20} color={fixed.white} />
					<Text style={{ fontSize: fs.xl, fontFamily: fontFamily(700), color: fixed.white }}>{create.isPending ? t('Отправляем…') : t('Найти мастера')}</Text>
				</Pressable>
			</View>

			{pickCar ? (
				<ModalSheet onClose={() => setPickCar(false)}>
					<Text style={{ fontSize: fs.xxl, fontFamily: fontFamily(700), color: c.ink }}>{t('Какая машина')}</Text>
					{(cars.data ?? []).map((item) => (
						<Pressable
							key={item.id}
							onPress={() => {
								setCarId(item.id)
								setPickCar(false)
							}}
							style={{
								height: 56,
								borderRadius: 14,
								backgroundColor: item.id === car?.id ? c.brandTint : c.surface,
								flexDirection: 'row',
								alignItems: 'center',
								gap: 12,
								paddingHorizontal: 12,
							}}
						>
							<BrandLogo brand={item.brand} size={32} />
							<Text style={{ flex: 1, fontSize: fs.lg, fontFamily: fontFamily(600), color: c.ink }}>{item.title}</Text>
							<Text style={{ fontSize: fs.md, fontFamily: fontFamily(400), color: c.muted }}>{item.year}</Text>
						</Pressable>
					))}
					<Text
						onPress={() => {
							setPickCar(false)
							router.push('/garage-add')
						}}
						style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: c.brandStrong, textAlign: 'center', paddingVertical: 8 }}
					>{t('+ Добавить машину')}</Text>
				</ModalSheet>
			) : null}

		</View>
	)
}

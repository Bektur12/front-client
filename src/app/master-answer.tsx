import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { useConfirmLeave } from '@/lib/use-confirm-leave'
import { toast } from '@/components/ui'
import { VoicePlayer, VoiceRecordingPanel, VoiceResultPanel, useVoiceNote } from '@/components/voice'
import { CheckMark, MicOutline, SendPlane } from '@/components/master-v23'
import { MediaStrip } from '@/components/media-strip'
import { fixed, fontFamily, fs, sectionTitle, useColors } from '@/theme'
import { formatClock, formatNumber } from '@/lib/format'
import { useMasterOffer, useMasterRequest } from '@/api/services'
import { t } from '@/i18n'
import { KEYBOARD_DONE } from '@/components/keyboard-done'
import { goBack } from '@/lib/navigation'

type When = 'NOW' | 'TODAY' | 'TOMORROW'

const LAST_HOUR = 21

/** Hours the master can pick: today — from the next full hour, tomorrow — the working day. */
function hoursFor(day: Exclude<When, 'NOW'>, now: Date) {
	const first = day === 'TODAY' ? now.getHours() + 1 : 9
	return Array.from({ length: Math.max(0, LAST_HOUR - first + 1) }, (_, i) => first + i)
}

function atHour(day: Exclude<When, 'NOW'>, hour: number, now: Date) {
	const at = new Date(day === 'TODAY' ? now : now.getTime() + 86_400_000)
	at.setHours(hour, 0, 0, 0)
	return at
}

/**
 * 19 «Проверьте и отправьте» — the master's «Могу помочь»: price «от» and time filled from the voice note
 * (POST /media/voices purpose=OFFER), editable, → POST /my/master/requests/{id}/offer. `record=1` — started
 * from «Ответить голосом»: recording begins at once.
 */
export default function MasterAnswerScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const params = useLocalSearchParams<{ id: string; record?: string }>()
	const id = Number(params.id)
	const request = useMasterRequest(id).data
	const offer = useMasterOffer()
	const [openedAt] = useState(() => new Date())
	const [price, setPrice] = useState('')
	// Late in the evening «today + 2 hours» is already tomorrow — offer the morning instead.
	const [when, setWhen] = useState<When>(() => (hoursFor('TODAY', openedAt).length ? 'TODAY' : 'TOMORROW'))
	// The master picks the hour; by default — two hours from now, or 10:00 tomorrow.
	const [hour, setHour] = useState<Record<Exclude<When, 'NOW'>, number>>(() => ({
		TODAY: Math.min(openedAt.getHours() + 2, LAST_HOUR),
		TOMORROW: 10,
	}))
	// The voice goes to the client as is; the price and the time the master sets by hand.
	const voice = useVoiceNote('OFFER')

	// «Ответить голосом» [18] — start recording right away, once on open.
	useEffect(() => {
		if (params.record === '1') voice.start()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const priceValue = price ? Number(price) : null
	const busy = voice.recording || voice.uploading || offer.isPending
	const leave = useConfirmLeave(Boolean(price) || Boolean(voice.result) || voice.recording)
	const close = () => {
		if (voice.recording) voice.cancel()
		goBack()
	}

	const send = () => {
		if (busy) return
		const at = when === 'NOW' ? new Date() : atHour(when, hour[when], openedAt)
		offer.mutate(
			{
				id,
				body: {
					answer: 'CAN_HELP',
					priceFrom: priceValue ?? undefined,
					availableAt: at.toISOString(),
					voiceMediaId: voice.result?.voice.id,
				},
			},
			{ onSuccess: () => (toast(t('Ответ отправлен клиенту')), leave(() => goBack())) }
		)
	}

	const timeLabel = (value: When) => {
		if (value === 'NOW') return t('Сейчас')
		if (value === 'TODAY') return t('Сегодня')
		return t('Завтра')
	}

	const subtitle = request ? [request.description, request.car.modelLabel ?? request.car.label].filter(Boolean).join(' · ') : ' '

	return (
		<KeyboardAvoidingView
			style={{ flex: 1, paddingTop: insets.top + 12, backgroundColor: 'rgba(32,31,29,0.45)' }}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<Pressable style={{ flex: 1 }} onPress={close} />
			{/* Scrolls when the keyboard leaves no room — the client's voice and photos stay reachable. */}
			<View style={{ flexShrink: 1, backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
				<ScrollView
					bounces={false}
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={{ paddingTop: 10, paddingHorizontal: 16, paddingBottom: 28 + insets.bottom, gap: 12 }}
				>
					<View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: 'center' }} />

					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
						<View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center' }}>
							<CheckMark size={22} color={fixed.white} strokeWidth={2.2} />
						</View>
						<View style={{ flex: 1, gap: 1 }}>
							<Text style={{ fontSize: fs.h3, lineHeight: 28.6, fontFamily: fontFamily(800), color: c.ink }}>{t('Проверьте и отправьте')}</Text>
							<Text numberOfLines={1} style={{ fontSize: fs.md, lineHeight: 20, fontFamily: fontFamily(400), color: c.muted }}>
								{subtitle}
							</Text>
						</View>
					</View>

					{/* The client's request stays in sight: the voice note to listen again, the photos and videos. */}
					{request && (request.voice || request.media.length) && !voice.recording ? (
						<View style={{ gap: 8 }}>
							{request.voice ? <VoicePlayer voice={request.voice} background={c.surface} /> : null}
							<MediaStrip media={request.media} />
						</View>
					) : null}

					{voice.recording || voice.uploading ? (
						<VoiceRecordingPanel seconds={voice.seconds} uploading={voice.uploading} onDone={voice.stop} onCancel={voice.cancel} />
					) : voice.result ? (
						<VoiceResultPanel voice={voice.result.voice} onRerecord={() => (voice.reset(), voice.start())} />
					) : (
						<Pressable
							onPress={voice.start}
							style={{ height: 48, borderRadius: 14, backgroundColor: c.brandTint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
						>
							<MicOutline size={20} color={c.brandStrong} />
							<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('Сказать голосом')}</Text>
						</Pressable>
					)}
					{voice.error ? <Text style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.danger }}>{voice.error}</Text> : null}

					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
						<Text style={{ ...sectionTitle, color: c.inkSecondary }}>
							{voice.result ? t('Заполнили из голоса') : t('Цена и когда сможете')}
						</Text>
						<View style={{ flex: 1 }} />
						{voice.result ? <Text style={{ fontSize: fs.sm, fontFamily: fontFamily(500), color: c.muted }}>{t('можно поправить')}</Text> : null}
					</View>

					<View
						style={{
							height: 64,
							borderRadius: 16,
							borderWidth: 2.5,
							borderColor: priceValue ? c.success : c.border,
							flexDirection: 'row',
							alignItems: 'center',
							paddingHorizontal: 16,
							gap: 8,
						}}
					>
						<Text style={{ fontSize: fs.xxl, fontFamily: fontFamily(700), color: c.muted }}>{t('от')}</Text>
						<TextInput inputAccessoryViewID={KEYBOARD_DONE}
							value={priceValue ? formatNumber(priceValue) : ''}
							onChangeText={(value) => setPrice(value.replace(/\D/g, '').slice(0, 7))}
							keyboardType="number-pad"
							placeholder="0"
							placeholderTextColor={c.border}
							style={{ flex: 1, minWidth: 40, fontSize: fs.hero, fontFamily: fontFamily(800), letterSpacing: -0.64, color: c.ink, padding: 0 }}
						/>
						<Text style={{ fontSize: fs.xxl, fontFamily: fontFamily(700), color: c.muted }}>{t('сом')}</Text>
					</View>

					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
						{(['NOW', 'TODAY', 'TOMORROW'] as const).filter((value) => value !== 'TODAY' || hoursFor('TODAY', openedAt).length).map((value) => {
							const selected = value === when
							return (
								<Pressable
									key={value}
									onPress={() => setWhen(value)}
									style={{
										flex: 1,
										height: 46,
										borderRadius: 12,
										backgroundColor: selected ? c.brandTint : c.card,
										borderWidth: 2,
										borderColor: selected ? c.brand : c.border,
										flexDirection: 'row',
										alignItems: 'center',
										justifyContent: 'center',
										gap: 6,
									}}
								>
									<Text numberOfLines={1} style={{ fontSize: fs.base, fontFamily: fontFamily(selected ? 700 : 600), color: selected ? c.brandStrong : c.ink }}>
										{timeLabel(value)}
									</Text>
								</Pressable>
							)
						})}
					</View>

					{when !== 'NOW' ? (
						<ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
							{hoursFor(when, openedAt).map((h) => {
								const selected = hour[when] === h
								return (
									<Pressable
										key={h}
										onPress={() => setHour((current) => ({ ...current, [when]: h }))}
										style={{
											height: 40,
											paddingHorizontal: 14,
											borderRadius: 20,
											backgroundColor: selected ? c.brand : c.surface,
											alignItems: 'center',
											justifyContent: 'center',
										}}
									>
										<Text style={{ fontSize: fs.base, fontFamily: fontFamily(selected ? 700 : 600), color: selected ? fixed.white : c.ink }}>
											{formatClock(atHour(when, h, openedAt))}
										</Text>
									</Pressable>
								)
							})}
						</ScrollView>
					) : null}

					{offer.error ? <Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.danger }}>{offer.error.message}</Text> : null}

					<Pressable
						onPress={send}
						disabled={busy}
						style={{
							height: 58,
							borderRadius: 14,
							backgroundColor: c.brand,
							flexDirection: 'row',
							alignItems: 'center',
							justifyContent: 'center',
							gap: 8,
							opacity: busy ? 0.5 : 1,
						}}
					>
						<SendPlane size={20} color={fixed.white} />
						<Text style={{ fontSize: fs.xl, fontFamily: fontFamily(700), color: fixed.white }}>{offer.isPending ? t('Отправляем…') : t('Отправить клиенту')}</Text>
					</Pressable>
				</ScrollView>
			</View>
		</KeyboardAvoidingView>
	)
}

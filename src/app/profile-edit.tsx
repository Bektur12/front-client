import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from '@/components/ui/image'
import { Button, ScreenHeader, toast } from '@/components/ui'
import { KEYBOARD_DONE } from '@/components/keyboard-done'
import { fixed, fontFamily, fs, sectionTitle, useColors } from '@/theme'
import { resolveUrl } from '@/lib/api'
import { useMe, useUpdateMe } from '@/api/me'
import { usePhotoUploads } from '@/api/media'
import { t } from '@/i18n'
import { goBack } from '@/lib/navigation'

/** The cities people pick most; anything else goes in «Другой». */
const CITIES = [t('Бишкек'), t('Ош'), t('Джалал-Абад'), t('Каракол'), t('Токмок'), t('Кара-Балта'), t('Узген'), t('Нарын'), t('Талас'), t('Баткен')]

/** «Профиль»: photo, name and city — no password, sign-in stays by code. */
export default function ProfileEditScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const me = useMe().data
	const save = useUpdateMe()
	// The photo is saved as soon as it is uploaded — no need to press «Сохранить» for it.
	const avatar = usePhotoUploads('AVATAR', 1, (photo) => save.mutateAsync({ avatarMediaId: photo.id }))
	const [name, setName] = useState(me?.name ?? '')
	const [city, setCity] = useState(me?.city ?? '')
	const [other, setOther] = useState(Boolean(me?.city && !CITIES.includes(me.city)))
	const uploading = avatar.photos.length > 0
	const letter = (name.trim() || '?').charAt(0).toUpperCase()

	const submit = () =>
		save.mutate({ name: name.trim() || undefined, city: city.trim() }, { onSuccess: () => (toast(t('Сохранено')), goBack()) })

	const chip = (label: string, selected: boolean, onPress: () => void) => (
		<Pressable
			key={label}
			onPress={onPress}
			style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: selected ? c.brand : c.card, justifyContent: 'center' }}
		>
			<Text style={{ fontSize: fs.base, fontFamily: fontFamily(selected ? 700 : 600), color: selected ? fixed.white : c.ink }}>{label}</Text>
		</Pressable>
	)

	const field = {
		height: 54,
		borderRadius: 14,
		borderWidth: 2,
		borderColor: c.border,
		backgroundColor: c.card,
		paddingHorizontal: 16,
		fontSize: fs.lg,
		fontFamily: fontFamily(500),
		color: c.ink,
	} as const

	return (
		<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.surface }}>
			<ScreenHeader inset title={t('Профиль')} />
			<ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
				<Pressable onPress={() => avatar.pick('library')} disabled={uploading} style={{ alignSelf: 'center', alignItems: 'center', gap: 8 }}>
					{me?.avatarUrl ? (
						<Image source={{ uri: resolveUrl(me.avatarUrl) }} style={{ width: 96, height: 96, borderRadius: 48 }} />
					) : (
						<View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: c.brandTint, alignItems: 'center', justifyContent: 'center' }}>
							<Text style={{ fontSize: fs.display, fontFamily: fontFamily(800), color: c.brandStrong }}>{letter}</Text>
						</View>
					)}
					{uploading ? <ActivityIndicator color={c.brand} /> : <Text style={{ fontSize: fs.md, fontFamily: fontFamily(700), color: c.brandStrong }}>{me?.avatarUrl ? t('Сменить фото') : t('Добавить фото')}</Text>}
				</Pressable>

				<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{t('Имя')}</Text>
				<TextInput
					inputAccessoryViewID={KEYBOARD_DONE}
					value={name}
					onChangeText={setName}
					placeholder={t('Как к вам обращаться')}
					placeholderTextColor={c.muted}
					maxLength={120}
					style={field}
				/>

				<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{t('Город')}</Text>
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
					{CITIES.map((item) => chip(item, !other && city === item, () => (setOther(false), setCity(item))))}
					{chip(t('Другой'), other, () => (setOther(true), setCity(CITIES.includes(city) ? '' : city)))}
				</View>
				{other ? (
					<TextInput
						inputAccessoryViewID={KEYBOARD_DONE}
						value={city}
						onChangeText={setCity}
						placeholder={t('Ваш город или село')}
						placeholderTextColor={c.muted}
						maxLength={60}
						style={field}
					/>
				) : null}

				{save.error ? <Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.danger }}>{save.error.message}</Text> : null}
			</ScrollView>
			<View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
				<Button label={t('Сохранить')} loading={save.isPending && !uploading} disabled={!name.trim()} onPress={submit} />
			</View>
		</KeyboardAvoidingView>
	)
}

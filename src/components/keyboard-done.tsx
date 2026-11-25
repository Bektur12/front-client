import { InputAccessoryView, Keyboard, Platform, Pressable, Text, View } from 'react-native'
import { fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

/** `inputAccessoryViewID` of every TextInput: the iOS number pad has no return key, multiline Enter is a new line. */
export const KEYBOARD_DONE = 'keyboard-done'

/** «Готово» above the iOS keyboard — mounted once in the root layout, shared by all inputs. */
export function KeyboardDoneBar() {
	const c = useColors()
	if (Platform.OS !== 'ios') return null
	return (
		<InputAccessoryView nativeID={KEYBOARD_DONE}>
			<View
				style={{
					height: 44,
					paddingHorizontal: 16,
					alignItems: 'flex-end',
					justifyContent: 'center',
					backgroundColor: c.card,
					borderTopWidth: 1,
					borderTopColor: c.border,
				}}
			>
				<Pressable onPress={Keyboard.dismiss} hitSlop={10}>
					<Text style={{ fontSize: fs.lg, fontFamily: fontFamily(700), color: c.brandStrong }}>{t('Готово')}</Text>
				</Pressable>
			</View>
		</InputAccessoryView>
	)
}

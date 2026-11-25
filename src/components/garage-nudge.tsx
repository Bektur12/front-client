import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { router, useIsFocused } from 'expo-router'
import { Button } from '@/components/ui'
import { ModalSheet } from '@/components/master-v23'
import { WheelIcon } from '@/components/buyer-v23'
import { useCars } from '@/api/garage'
import { useSignedIn } from '@/api/catalog'
import { usePushPrimer } from '@/lib/push'
import { readJson, writeJson } from '@/lib/local-json'
import { fontFamily, fs, useColors } from '@/theme'
import { t } from '@/i18n'

const FILE = 'garage-nudge'
/** «Позже» — снова не раньше чем через 3 дня. */
const SNOOZE_MS = 3 * 24 * 60 * 60_000

/**
 * Гараж пустой — снизу мягкое «Добавьте свою машину»: с машиной каталог, запросы и «Подходит к вашей …» работают
 * под неё. Не поверх окна про уведомления; «Позже» — на 3 дня.
 */
export function GarageNudge() {
	const c = useColors()
	const focused = useIsFocused()
	const signedIn = useSignedIn()
	const cars = useCars(signedIn)
	const pushPrimer = usePushPrimer((s) => s.moment)
	const [due, setDue] = useState(false)
	const [open, setOpen] = useState(false)

	const empty = signedIn && cars.isSuccess && cars.data.length === 0

	useEffect(() => {
		if (!empty) return
		let alive = true
		readJson<{ until: number }>(FILE).then((saved) => {
			if (alive && (!saved || saved.until < Date.now())) setDue(true)
		})
		return () => {
			alive = false
		}
	}, [empty])

	// Не сразу на входе — дать осмотреться пару секунд.
	useEffect(() => {
		if (!due || !focused || pushPrimer) return
		const timer = setTimeout(() => setOpen(true), 1500)
		return () => clearTimeout(timer)
	}, [due, focused, pushPrimer])

	const later = () => {
		writeJson(FILE, { until: Date.now() + SNOOZE_MS })
		setDue(false)
		setOpen(false)
	}
	const add = () => {
		later()
		router.push('/garage-add')
	}

	if (!open || !empty) return null
	return (
		<ModalSheet onClose={later}>
			<View style={{ alignItems: 'center', gap: 12, paddingTop: 6 }}>
				<View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.brandTint, alignItems: 'center', justifyContent: 'center' }}>
					<WheelIcon size={36} color={c.brandStrong} strokeWidth={2} />
				</View>
				<Text style={{ fontSize: fs.h3, fontFamily: fontFamily(800), color: c.ink, textAlign: 'center' }}>{t('Добавьте свою машину')}</Text>
				<Text style={{ fontSize: fs.base, lineHeight: 23, fontFamily: fontFamily(400), color: c.inkSecondary, textAlign: 'center' }}>
					{t('Покажем запчасти, которые подойдут именно ей')}
				</Text>
			</View>
			<View style={{ gap: 8, paddingTop: 6 }}>
				<Button label={t('Добавить машину')} onPress={add} />
				<Button label={t('Позже')} variant="outline" onPress={later} />
			</View>
		</ModalSheet>
	)
}

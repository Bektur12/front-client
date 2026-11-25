import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, ScreenHeader, Toggle, toast } from '@/components/ui'
import { fixed, fontFamily, fs, sectionTitle, useColors } from '@/theme'
import { WEEK, formatSchedule, hhmm, type WeekDay } from '@/lib/hours'
import { useMyShop, useUpdateShop } from '@/api/shop'
import { t } from '@/i18n'
import { goBack } from '@/lib/navigation'

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const pad = (h: number) => `${String(h).padStart(2, '0')}:00:00`
const hourOf = (value: unknown) => Number(hhmm(value).split(':')[0])

/** «Время работы» продавца: дни и часы — покупатели видят «Открыто до 18:00» / «Закрыто · откроется завтра 9:00». */
export default function ShopHoursScreen() {
	const c = useColors()
	const insets = useSafeAreaInsets()
	const shop = useMyShop().data
	const save = useUpdateShop()
	const initial = shop?.open
	const wasAllDay = initial ? hhmm(initial.openFrom) === '0:00' && hhmm(initial.openTo) === '23:59' : false
	const [allDay, setAllDay] = useState(wasAllDay)
	const [from, setFrom] = useState(() => (initial && !wasAllDay ? hourOf(initial.openFrom) : 9))
	const [to, setTo] = useState(() => (initial && !wasAllDay ? hourOf(initial.openTo) || 24 : 18))
	const [days, setDays] = useState<WeekDay[]>(() => initial?.workDays ?? WEEK.slice(0, 6).map((item) => item.day))
	const valid = days.length > 0 && (allDay || from < to)

	const toggleDay = (day: WeekDay) => setDays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day]))
	const submit = () =>
		save.mutate(
			{
				openFrom: allDay ? '00:00:00' : pad(from),
				openTo: allDay || to === 24 ? '23:59:00' : pad(to),
				workDays: WEEK.map((item) => item.day).filter((day) => days.includes(day)),
			},
			{ onSuccess: () => (toast(t('Время работы сохранено')), goBack()) }
		)

	const hourRow = (value: number, onPick: (h: number) => void, options: number[]) => (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
			{options.map((h) => {
				const selected = h === value
				return (
					<Pressable
						key={h}
						onPress={() => onPick(h)}
						style={{ height: 40, minWidth: 56, paddingHorizontal: 12, borderRadius: 20, backgroundColor: selected ? c.brand : c.card, alignItems: 'center', justifyContent: 'center' }}
					>
						<Text style={{ fontSize: fs.base, fontFamily: fontFamily(selected ? 700 : 600), color: selected ? fixed.white : c.ink }}>{`${h}:00`}</Text>
					</Pressable>
				)
			})}
		</ScrollView>
	)

	return (
		<View style={{ flex: 1, backgroundColor: c.surface }}>
			<ScreenHeader inset title={t('Время работы')} />
			<ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}>
				<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{t('Рабочие дни')}</Text>
				<View style={{ flexDirection: 'row', gap: 6 }}>
					{WEEK.map((item) => {
						const on = days.includes(item.day)
						return (
							<Pressable
								key={item.day}
								onPress={() => toggleDay(item.day)}
								style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: on ? c.brand : c.card, alignItems: 'center', justifyContent: 'center' }}
							>
								<Text style={{ fontSize: fs.base, fontFamily: fontFamily(700), color: on ? fixed.white : c.ink }}>{item.short}</Text>
							</Pressable>
						)
					})}
				</View>

				<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, backgroundColor: c.card, paddingHorizontal: 14, height: 56 }}>
					<Text style={{ fontSize: fs.lg, fontFamily: fontFamily(600), color: c.ink }}>{t('Круглосуточно')}</Text>
					<Toggle value={allDay} onChange={setAllDay} />
				</View>

				{allDay ? null : (
					<>
						<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{t('Открываемся')}</Text>
						{hourRow(from, (h) => (setFrom(h), h >= to && setTo(Math.min(h + 1, 24))), HOURS)}
						<Text style={{ ...sectionTitle, color: c.inkSecondary }}>{t('Закрываемся')}</Text>
						{hourRow(to, setTo, HOURS.map((h) => h + 1).filter((h) => h > from))}
					</>
				)}

				{valid ? (
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.muted }}>
						{t('Покупатели увидят: {0}', formatSchedule({
							openNow: true,
							closedManually: false,
							openFrom: (allDay ? '00:00:00' : pad(from)) as never,
							openTo: (allDay || to === 24 ? '23:59:00' : pad(to)) as never,
							workDays: WEEK.map((item) => item.day).filter((day) => days.includes(day)),
							opensAt: null,
						}))}
					</Text>
				) : (
					<Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.danger }}>{t('Выберите хотя бы один день')}</Text>
				)}
				{save.error ? <Text style={{ fontSize: fs.md, fontFamily: fontFamily(500), color: c.danger }}>{save.error.message}</Text> : null}
			</ScrollView>
			<View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12 }}>
				<Button label={t('Сохранить')} disabled={!valid} loading={save.isPending} onPress={submit} />
			</View>
		</View>
	)
}

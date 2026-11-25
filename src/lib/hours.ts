import { formatWhenAt } from '@/lib/format'
import type { components } from '@/api/schema'
import { t } from '@/i18n'

export type OpenState = components['schemas']['OpenStateDto']
export type WeekDay = OpenState['workDays'][number]

export const WEEK: { day: WeekDay; short: string }[] = [
	{ day: 'MONDAY', short: t('Пн') },
	{ day: 'TUESDAY', short: t('Вт') },
	{ day: 'WEDNESDAY', short: t('Ср') },
	{ day: 'THURSDAY', short: t('Чт') },
	{ day: 'FRIDAY', short: t('Пт') },
	{ day: 'SATURDAY', short: t('Сб') },
	{ day: 'SUNDAY', short: t('Вс') },
]

/** The API sends LocalTime as «08:00:00» (the OpenAPI schema says object — BACKEND_QUESTIONS.md #1). */
export function hhmm(value: unknown) {
	const [h = '0', m = '00'] = String(value).split(':')
	return `${Number(h)}:${m}`
}

/** 00:00–23:59 — the default «round the clock». */
function roundTheClock(open: OpenState) {
	return hhmm(open.openFrom) === '0:00' && hhmm(open.openTo) === '23:59'
}

/** «Пн–Пт», «Пн–Сб, Вс», «Ежедневно». */
export function formatWorkDays(days: WeekDay[]) {
	if (days.length === 7) return t('Ежедневно')
	const runs: string[] = []
	let start = -1
	WEEK.forEach((item, i) => {
		const on = days.includes(item.day)
		if (on && start < 0) start = i
		const next = WEEK[i + 1]
		if (start >= 0 && (!next || !days.includes(next.day))) {
			runs.push(start === i ? WEEK[i].short : i - start === 1 ? `${WEEK[start].short}, ${WEEK[i].short}` : `${WEEK[start].short}–${WEEK[i].short}`)
			start = -1
		}
	})
	return runs.join(', ')
}

/** «Пн–Сб · 9:00–18:00», «Ежедневно · круглосуточно». */
export function formatSchedule(open: OpenState) {
	const hours = roundTheClock(open) ? t('круглосуточно') : `${hhmm(open.openFrom)}–${hhmm(open.openTo)}`
	return `${formatWorkDays(open.workDays)} · ${hours}`
}

/** «Открыто до 18:00», «Открыто круглосуточно», «Закрыто · откроется завтра 9:00». */
export function formatOpenNow(open: OpenState): { open: boolean; label: string } {
	if (open.openNow) {
		return { open: true, label: roundTheClock(open) && open.workDays.length === 7 ? t('Открыто круглосуточно') : t('Открыто до {0}', hhmm(open.openTo)) }
	}
	if (open.opensAt) return { open: false, label: t('Закрыто · откроется {0}', formatWhenAt(open.opensAt)) }
	return { open: false, label: t('Закрыто') }
}

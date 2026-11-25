import type { ReactNode } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Image } from '@/components/ui/image'
import { MoreButton, Skeleton } from '@/components/ui'
import { BoxOutlineIcon, ChevronIcon, LiveDot, MetaChip, WrenchIcon, priceDigits } from '@/components/buyer-v23'
import { fontFamily, fs, useColors } from '@/theme'
import { resolveUrl } from '@/lib/api'
import { minutesLeft, plural } from '@/lib/format'
import { useDeleteRequest } from '@/api/requests'
import { serviceName, useDeleteServiceRequest, useServiceTypes } from '@/api/services'
import type { RequestSummary, ServiceRequestSummary } from '@/api/types'
import { t } from '@/i18n'

export type MyRequestRow = { kind: 'part'; request: RequestSummary } | { kind: 'service'; request: ServiceRequestSummary }

/** «Мои запросы» по разделам: ищем сейчас, нашли (кто-то ответил «есть» / «могу помочь»), не нашли. */
export type MyRequestGroup = 'active' | 'found' | 'notFound'

export function requestGroup(row: MyRequestRow): MyRequestGroup {
	if (row.request.status === 'ACTIVE' && minutesLeft(row.request.expiresAt) > 0) return 'active'
	const answers = row.kind === 'part' ? row.request.haveCount : row.request.canHelpCount
	return answers > 0 ? 'found' : 'notFound'
}

/** Parts and service requests in one list, newest first. */
export function mergeRequests(parts: RequestSummary[], services: ServiceRequestSummary[]): MyRequestRow[] {
	return [
		...parts.map((request) => ({ kind: 'part' as const, request })),
		...services.map((request) => ({ kind: 'service' as const, request })),
	].sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt))
}

/** A card of «Мои запросы»: tile, title, status line, ⋯ (delete), chevron; the stats chips under it. */
function RequestCard({
	tile,
	title,
	status,
	live,
	chips,
	onPress,
	onDelete,
}: {
	tile: ReactNode
	title: string
	status: string
	live?: boolean
	chips: { label: string; tone?: 'green' | 'grey' }[]
	onPress: () => void
	onDelete: () => void
}) {
	const c = useColors()
	return (
		<Pressable onPress={onPress} onLongPress={onDelete} style={{ borderRadius: 18, backgroundColor: c.card, padding: 12, gap: 10 }}>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
				{tile}
				<View style={{ flex: 1, gap: 3 }}>
					<Text numberOfLines={1} style={{ fontSize: fs.lg, fontFamily: fontFamily(700), color: c.ink }}>
						{title}
					</Text>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
						{live ? <LiveDot /> : null}
						<Text numberOfLines={1} style={{ flex: 1, fontSize: fs.md, fontFamily: fontFamily(400), color: c.muted }}>
							{status}
						</Text>
					</View>
				</View>
				<MoreButton label={t('Удалить запрос')} onPress={onDelete} />
				<ChevronIcon size={20} color={c.chevron} />
			</View>
			{chips.length ? (
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
					{chips.map((chip) => (
						<MetaChip key={chip.label} label={chip.label} tone={chip.tone} />
					))}
				</View>
			) : null}
		</Pressable>
	)
}

export function RequestCardSkeleton() {
	const c = useColors()
	return (
		<View style={{ borderRadius: 18, backgroundColor: c.card, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
			<Skeleton width={52} height={52} radius={14} />
			<View style={{ flex: 1, gap: 9 }}>
				<Skeleton width="70%" height={17} />
				<Skeleton width="45%" height={14} />
			</View>
		</View>
	)
}

/** The tile on the left: the request's photo when there is one (so the rows don't look alike), else the icon. */
export function Tile({ children, photo }: { children: ReactNode; photo?: string | null }) {
	const c = useColors()
	if (photo) return <Image source={{ uri: resolveUrl(photo) }} style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: c.brandTint }} />
	return (
		<View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: c.brandTint, alignItems: 'center', justifyContent: 'center' }}>
			{children}
		</View>
	)
}

/** «Удалить запрос?» — the request leaves the list; an open one is closed, sellers stop seeing it. */
function confirmDelete(open: boolean, remove: () => void) {
	Alert.alert(
		t('Удалить запрос?'),
		open ? t('Он пропадёт из списка, продавцы и мастера перестанут его видеть.') : t('Он пропадёт из списка.'),
		[
			{ text: t('Отмена'), style: 'cancel' },
			{ text: t('Удалить'), style: 'destructive', onPress: remove },
		]
	)
}

/** A parts request: «Ищем ещё 18 мин» and the stats — «Есть 3 · от 2 900 с», «Нет 5», «Посмотрели 12». */
export function RequestRow({ request }: { request: RequestSummary }) {
	const c = useColors()
	const remove = useDeleteRequest()
	const left = minutesLeft(request.expiresAt)
	const active = request.status === 'ACTIVE' && left > 0
	const status =
		request.state === 'CLOSED'
			? t('Закрыт')
			: active
				? t('Ищем ещё {0} мин', left)
				: request.haveCount > 0
					? t('Нашли · время вышло')
					: t('Никто не ответил «есть»')
	const chips: { label: string; tone?: 'green' | 'grey' }[] = []
	if (request.haveCount > 0)
		chips.push({ label: t('Есть {0}', request.haveCount) + (request.minPrice != null ? t(' · от {0} с', priceDigits(request.minPrice)) : ''), tone: 'green' })
	if (request.notHaveCount > 0) chips.push({ label: t('Нет {0}', request.notHaveCount) })
	if (request.seenCount > 0) chips.push({ label: t('Посмотрели {0}', request.seenCount) })
	return (
		<RequestCard
			tile={
				<Tile photo={request.thumbUrl}>
					<BoxOutlineIcon size={22} color={c.brandStrong} />
				</Tile>
			}
			title={request.text}
			status={status}
			live={active}
			chips={chips}
			onPress={() => router.push({ pathname: '/request', params: { id: String(request.id) } })}
			onDelete={() => confirmDelete(request.status !== 'CLOSED', () => remove.mutate(request.id))}
		/>
	)
}

/** A service request: «Ремонт · 2 мастера ответили». */
export function ServiceRow({ request }: { request: ServiceRequestSummary }) {
	const c = useColors()
	const types = useServiceTypes().data
	const remove = useDeleteServiceRequest()
	const offers = request.canHelpCount
	const service = serviceName(types, request.service.code, true)
	const status =
		request.state === 'CLOSED'
			? t('{0} · договорились', service)
			: offers > 0
				? `${service} · ${offers} ${plural(offers, [t('мастер ответил'), t('мастера ответили'), t('мастеров ответили')])}`
				: request.status === 'ACTIVE'
					? t('{0} · ждём мастеров', service)
					: t('{0} · никто не ответил', service)
	return (
		<RequestCard
			tile={
				<Tile photo={request.thumbUrl}>
					<WrenchIcon size={22} color={c.brandStrong} />
				</Tile>
			}
			title={request.description}
			status={status}
			live={request.status === 'ACTIVE' && minutesLeft(request.expiresAt) > 0}
			chips={offers > 0 ? [{ label: t('Могут помочь {0}', offers), tone: 'green' }] : []}
			onPress={() => router.push({ pathname: '/service-offers', params: { id: String(request.id) } })}
			onDelete={() => confirmDelete(request.status !== 'CLOSED', () => remove.mutate(request.id))}
		/>
	)
}

export function MyRequestItem({ row }: { row: MyRequestRow }) {
	return row.kind === 'part' ? <RequestRow request={row.request} /> : <ServiceRow request={row.request} />
}

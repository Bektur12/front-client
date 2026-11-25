import { create } from 'zustand'
import { ApiError, apiFetch } from '@/lib/api'
import { readJson, writeJson } from '@/lib/local-json'
import { useSession } from '@/store/useSession'
import type { OfflinePack, OfflinePackVersion } from '@/api/types'

// The master directory on the phone (GET /roadside/offline-pack) — for places without internet. A file in the
// app's documents, not the TanStack cache: logout and cache resets must not wipe it before a long drive.

const FILE = 'roadside-pack'
/** Don't ask the server more often than this on its own; «Обновить» on the screen forces it. */
const CHECK_EVERY_MS = 6 * 60 * 60_000
/** Older than this — «перед дальней дорогой обновите справочник». */
export const PACK_STALE_MS = 3 * 24 * 60 * 60_000

interface Saved {
	pack: OfflinePack
	/** When the content last changed on the phone (downloaded). */
	savedAt: number
	/** When the server last confirmed it is current. */
	checkedAt: number
}

interface RoadsidePackState {
	pack: OfflinePack | null
	savedAt: number | null
	checkedAt: number | null
	loaded: boolean
	syncing: boolean
	load: () => Promise<void>
	/** Version check, then download only when it changed. Offline or rate-limited — keep what we have. */
	sync: (options?: { force?: boolean }) => Promise<void>
	/** Account deletion — the directory goes too. */
	clear: () => void
}

let syncing: Promise<void> | null = null

export const useRoadsidePack = create<RoadsidePackState>((set, get) => ({
	pack: null,
	savedAt: null,
	checkedAt: null,
	loaded: false,
	syncing: false,

	load: async () => {
		if (get().loaded) return
		const saved = await readJson<Saved>(FILE)
		set({ pack: saved?.pack ?? null, savedAt: saved?.savedAt ?? null, checkedAt: saved?.checkedAt ?? null, loaded: true })
	},

	sync: (options = {}) => {
		syncing ??= (async () => {
			await get().load()
			if (useSession.getState().status !== 'authed') return
			const { pack, checkedAt } = get()
			if (!options.force && pack && checkedAt && Date.now() - checkedAt < CHECK_EVERY_MS) return
			set({ syncing: true })
			try {
				if (pack) {
					const current = await apiFetch<OfflinePackVersion>('/roadside/offline-pack/version')
					if (current.version === pack.version) {
						save({ pack, savedAt: get().savedAt ?? Date.now(), checkedAt: Date.now() })
						return
					}
				}
				const next = await apiFetch<OfflinePack>('/roadside/offline-pack', {
					headers: pack ? { 'If-None-Match': `"${pack.version}"` } : undefined,
				})
				const now = Date.now()
				save({ pack: next, savedAt: now, checkedAt: now })
			} catch (error) {
				// 304 — not changed; 429 — downloaded too often today; no network — keep the saved one.
				if (error instanceof ApiError && error.status === 304 && pack) {
					save({ pack, savedAt: get().savedAt ?? Date.now(), checkedAt: Date.now() })
				}
			} finally {
				set({ syncing: false })
			}
		})().finally(() => {
			syncing = null
		})
		return syncing
	},

	clear: () => {
		writeJson(FILE, null)
		set({ pack: null, savedAt: null, checkedAt: null })
	},
}))

function save(saved: Saved) {
	writeJson(FILE, saved)
	useRoadsidePack.setState({ pack: saved.pack, savedAt: saved.savedAt, checkedAt: saved.checkedAt })
}

import { router, type Href } from 'expo-router'

/**
 * «Назад», which always goes somewhere. A screen opened from a push, a link or a web reload has nothing behind it —
 * `router.back()` then does nothing (GO_BACK «was not handled by any navigator») and the button looks dead.
 * Without history: the fallback, by default `/`, which redirects to the user's home by role.
 */
export function goBack(fallback: Href = '/') {
	if (router.canGoBack()) router.back()
	else router.replace(fallback)
}

/**
 * Open a screen with nothing behind it: sign-in → role → registration → home. Without this the catalog the guest
 * signed in from stays under the registration, and «Назад» or a swipe from the edge drops a new seller onto the
 * buyer's screens.
 */
export function resetTo(href: Href) {
	if (router.canDismiss()) router.dismissAll()
	router.replace(href)
}

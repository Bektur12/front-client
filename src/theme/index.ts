import { createContext, createElement, useContext, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { darkColors, lightColors, type Colors } from './tokens'

/** Тема, заданная экраном поверх системной (карта рынка всегда светлая — как сама подложка карты). */
const ForcedScheme = createContext<'light' | 'dark' | null>(null)

export function useColors(): Colors {
	const system = useColorScheme()
	const forced = useContext(ForcedScheme)
	return (forced ?? system) === 'dark' ? darkColors : lightColors
}

/** Всё внутри — в светлой теме, даже если в телефоне тёмная: экраны с картой. */
export function LightTheme({ children }: { children: ReactNode }) {
	return createElement(ForcedScheme.Provider, { value: 'light' }, children)
}

export * from './tokens'

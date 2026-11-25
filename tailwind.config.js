/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{js,jsx,ts,tsx}'],
	presets: [require('nativewind/preset')],
	// 'media' по умолчанию в вебе роняет приложение («Cannot manually set color scheme…» в react-native-css-interop).
	// Классы NativeWind в приложении не используются — тёмная тема идёт через useColors (src/theme).
	darkMode: 'class',
	theme: {
		extend: {},
	},
	plugins: [],
}

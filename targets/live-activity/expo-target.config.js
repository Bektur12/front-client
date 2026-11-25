/**
 * Live Activity продавца: карточка нового запроса на экране блокировки и в Dynamic Island — «Есть» / «Нет» / ▶
 * сразу, без долгого нажатия. Запускается пушем с бэкенда (push-to-start, iOS 17.2+). Сборку делает
 * @bacons/apple-targets; файлы из _shared попадают и в приложение (там iOS выполняет кнопки), и в виджет.
 * @type {import('@bacons/apple-targets/app.plugin').Config}
 */
module.exports = {
	type: 'widget',
	name: 'RequestLiveActivity',
	deploymentTarget: '17.0',
	frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit', 'AppIntents', 'AVFoundation'],
}

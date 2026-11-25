import ActivityKit
import Foundation

/// Карточка запроса покупателя. Поля и имя типа — ровно как шлёт бэкенд (RequestNotifier.liveActivity,
/// `attributes-type: RequestActivityAttributes`). Копия — в modules/kudaiberdi-live-activity: держать одинаковыми.
public struct RequestActivityAttributes: ActivityAttributes {
	public struct ContentState: Codable, Hashable {
		/// WAITING — ждёт ответа.
		public var status: String
	}

	public var requestId: Int
	public var shopId: Int
	public var carLabel: String
	public var text: String
	/// Конец запроса, секунды с 1970 (JSONDecoder ActivityKit не читает ISO-даты).
	public var expiresAt: Double
	/// Подписанный ключ ответа «Нет» без входа: POST /requests/{id}/quick-reply.
	public var quickToken: String
	/// Подписи на языке продавца: «Есть / Нет», «Бар / Жок».
	public var haveLabel: String
	public var noLabel: String
	public var expiredLabel: String
	public var photoUrl: String?
	public var voiceUrl: String?
	public var voiceSeconds: Int?

	public var expiresDate: Date { Date(timeIntervalSince1970: expiresAt) }
}

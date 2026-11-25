import ActivityKit
import AppIntents
import AVFoundation
import Foundation

/// Адрес API: ключ KudaiberdiApiUrl в Info.plist приложения (app.json → ios.infoPlist). Кнопки Live Activity
/// iOS выполняет в процессе приложения, поэтому Bundle.main — это приложение.
enum KudaiberdiApi {
	static var base: URL {
		let raw = Bundle.main.object(forInfoDictionaryKey: "KudaiberdiApiUrl") as? String
		return URL(string: raw ?? "https://kudaibergen-back-production.up.railway.app/api/v1")!
	}
}

/// «Нет» с экрана блокировки: ответ уходит по ключу карточки, приложение не открывается, карточка закрывается.
@available(iOS 17.0, *)
struct NotHaveIntent: LiveActivityIntent {
	static var title: LocalizedStringResource = "Нет"
	static var openAppWhenRun = false

	@Parameter(title: "Запрос") var requestId: Int
	@Parameter(title: "Ключ ответа") var token: String

	init() {}

	init(requestId: Int, token: String) {
		self.requestId = requestId
		self.token = token
	}

	func perform() async throws -> some IntentResult {
		var request = URLRequest(url: KudaiberdiApi.base.appendingPathComponent("requests/\(requestId)/quick-reply"))
		request.httpMethod = "POST"
		request.setValue("application/json", forHTTPHeaderField: "Content-Type")
		request.httpBody = try JSONSerialization.data(withJSONObject: ["token": token])
		request.timeoutInterval = 15
		// Не вышло (нет сети, запрос уже закрыт) — карточку всё равно убираем: ответить можно в приложении.
		_ = try? await URLSession.shared.data(for: request)
		for activity in Activity<RequestActivityAttributes>.activities where activity.attributes.requestId == requestId {
			await activity.end(nil, dismissalPolicy: .immediate)
		}
		return .result()
	}
}

/// ▶ — послушать голосовое покупателя прямо с экрана блокировки; повторное нажатие — стоп.
@available(iOS 17.0, *)
struct PlayVoiceIntent: AudioPlaybackIntent {
	static var title: LocalizedStringResource = "Послушать"

	@Parameter(title: "Голосовое") var url: String

	init() {}

	init(url: String) {
		self.url = url
	}

	func perform() async throws -> some IntentResult {
		await VoicePlayback.shared.toggle(url)
		return .result()
	}
}

@MainActor
final class VoicePlayback {
	static let shared = VoicePlayback()
	private var player: AVPlayer?

	func toggle(_ address: String) {
		if let player, player.rate > 0 {
			player.pause()
			self.player = nil
			return
		}
		guard let url = URL(string: address) else { return }
		try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
		try? AVAudioSession.sharedInstance().setActive(true)
		let player = AVPlayer(url: url)
		self.player = player
		player.play()
	}
}

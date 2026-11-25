import ActivityKit
import ExpoModulesCore

/// Копия RequestActivityAttributes из targets/live-activity/_shared: ActivityKit узнаёт карточку по имени типа
/// и полям, поэтому модуль (отдельный pod) держит свою копию. Менять — в обоих местах одинаково.
struct RequestActivityAttributes: ActivityAttributes {
	struct ContentState: Codable, Hashable {
		var status: String
	}

	var requestId: Int
	var shopId: Int
	var carLabel: String
	var text: String
	var expiresAt: Double
	var quickToken: String
	var haveLabel: String
	var noLabel: String
	var expiredLabel: String
	var photoUrl: String?
	var voiceUrl: String?
	var voiceSeconds: Int?
}

/// JS ↔ ActivityKit: push-to-start токен (его ждёт бэкенд в POST /devices) и закрытие карточки, когда продавец
/// ответил в самом приложении.
public class KudaiberdiLiveActivityModule: Module {
	private var tokenTask: Task<Void, Never>?

	public func definition() -> ModuleDefinition {
		Name("KudaiberdiLiveActivity")

		Events("onPushToStartToken")

		/// Карточки работают: iOS 17.2+ и пользователь не выключил Live Activities для приложения.
		Function("isSupported") { () -> Bool in
			if #available(iOS 17.2, *) {
				return ActivityAuthorizationInfo().areActivitiesEnabled
			}
			return false
		}

		OnStartObserving {
			guard #available(iOS 17.2, *) else { return }
			self.tokenTask?.cancel()
			self.tokenTask = Task { [weak self] in
				for await data in Activity<RequestActivityAttributes>.pushToStartTokenUpdates {
					let token = data.map { String(format: "%02x", $0) }.joined()
					self?.sendEvent("onPushToStartToken", ["token": token])
				}
			}
		}

		OnStopObserving {
			self.tokenTask?.cancel()
			self.tokenTask = nil
		}

		/// Продавец ответил в приложении (или из обычного пуша) — карточка этого запроса больше не нужна.
		AsyncFunction("end") { (requestId: Int) in
			guard #available(iOS 16.2, *) else { return }
			for activity in Activity<RequestActivityAttributes>.activities where activity.attributes.requestId == requestId {
				await activity.end(nil, dismissalPolicy: .immediate)
			}
		}
	}
}

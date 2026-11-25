import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

/// Цвета карточки: тёмное стекло, зелёная «Есть», красная «Нет», янтарный таймер — как на макете.
private enum Palette {
	static let background = Color(red: 0.07, green: 0.08, blue: 0.10)
	static let brand = Color(red: 0.13, green: 0.33, blue: 0.90)
	static let have = Color(red: 0.09, green: 0.64, blue: 0.29)
	static let no = Color(red: 0.86, green: 0.15, blue: 0.15)
	static let timer = Color(red: 0.98, green: 0.75, blue: 0.14)
	static let muted = Color.white.opacity(0.68)
}

struct RequestLiveActivity: Widget {
	var body: some WidgetConfiguration {
		ActivityConfiguration(for: RequestActivityAttributes.self) { context in
			LockScreenCard(context: context)
				.activityBackgroundTint(Palette.background.opacity(0.88))
				.activitySystemActionForegroundColor(.white)
				.widgetURL(answerURL(context.attributes))
		} dynamicIsland: { context in
			DynamicIsland {
				DynamicIslandExpandedRegion(.leading) {
					Label(context.attributes.carLabel, systemImage: "car.fill")
						.font(.caption.weight(.semibold))
						.lineLimit(1)
				}
				DynamicIslandExpandedRegion(.trailing) {
					Countdown(until: context.attributes.expiresDate)
						.font(.caption.weight(.bold))
				}
				DynamicIslandExpandedRegion(.center) {
					Text(context.attributes.text)
						.font(.subheadline.weight(.semibold))
						.lineLimit(1)
				}
				DynamicIslandExpandedRegion(.bottom) {
					if context.isStale {
						Text(context.attributes.expiredLabel).font(.caption).foregroundStyle(Palette.muted)
					} else {
						AnswerButtons(attributes: context.attributes)
					}
				}
			} compactLeading: {
				Image(systemName: "wrench.and.screwdriver.fill").foregroundStyle(Palette.brand)
			} compactTrailing: {
				Countdown(until: context.attributes.expiresDate)
					.font(.caption2.weight(.bold))
					.frame(maxWidth: 44)
			} minimal: {
				Image(systemName: "wrench.and.screwdriver.fill").foregroundStyle(Palette.brand)
			}
			.widgetURL(answerURL(context.attributes))
			.keylineTint(Palette.brand)
		}
	}
}

/// Нажатие на саму карточку и «Есть» — экран ответа с курсором в цене (решение: «Есть» открывает ввод цены).
private func answerURL(_ attributes: RequestActivityAttributes) -> URL {
	URL(string: "kudaibergenv2://seller-answer?id=\(attributes.requestId)&focus=price")!
}

private struct LockScreenCard: View {
	let context: ActivityViewContext<RequestActivityAttributes>

	var body: some View {
		VStack(alignment: .leading, spacing: 10) {
			HStack(spacing: 10) {
				RoundedRectangle(cornerRadius: 8)
					.fill(Palette.brand)
					.frame(width: 30, height: 30)
					.overlay(Text("K").font(.system(size: 15, weight: .heavy)).foregroundStyle(.white))
				VStack(alignment: .leading, spacing: 1) {
					Text(context.attributes.text)
						.font(.subheadline.weight(.bold))
						.lineLimit(1)
					Text(context.attributes.carLabel)
						.font(.caption)
						.foregroundStyle(Palette.muted)
						.lineLimit(1)
				}
				Spacer(minLength: 6)
				if context.isStale {
					Text(context.attributes.expiredLabel).font(.caption.weight(.semibold)).foregroundStyle(Palette.muted)
				} else {
					Countdown(until: context.attributes.expiresDate).font(.callout.weight(.heavy))
				}
			}
			if !context.isStale {
				AnswerButtons(attributes: context.attributes)
			}
		}
		.foregroundStyle(.white)
		.padding(14)
	}
}

/// «18:42» до конца запроса, считается на телефоне — без пушей-обновлений.
private struct Countdown: View {
	let until: Date

	var body: some View {
		Text(timerInterval: Date.now...max(until, Date.now), countsDown: true)
			.monospacedDigit()
			.multilineTextAlignment(.trailing)
			.foregroundStyle(Palette.timer)
	}
}

/// Зелёная «Есть» (открывает ввод цены), красная «Нет» (отвечает сразу), ▶ — если покупатель записал голосовое.
private struct AnswerButtons: View {
	let attributes: RequestActivityAttributes

	var body: some View {
		HStack(spacing: 8) {
			Link(destination: answerURL(attributes)) {
				label(attributes.haveLabel, color: Palette.have)
			}
			Button(intent: NotHaveIntent(requestId: attributes.requestId, token: attributes.quickToken)) {
				label(attributes.noLabel, color: Palette.no)
			}
			.buttonStyle(.plain)
			if let voice = attributes.voiceUrl {
				Button(intent: PlayVoiceIntent(url: voice)) {
					Image(systemName: "play.fill")
						.font(.system(size: 15, weight: .bold))
						.frame(width: 44, height: 40)
						.background(Color.white.opacity(0.16), in: RoundedRectangle(cornerRadius: 12))
				}
				.buttonStyle(.plain)
			}
		}
	}

	private func label(_ text: String, color: Color) -> some View {
		Text(text)
			.font(.system(size: 16, weight: .heavy))
			.foregroundStyle(.white)
			.frame(maxWidth: .infinity, minHeight: 40)
			.background(color, in: RoundedRectangle(cornerRadius: 12))
	}
}

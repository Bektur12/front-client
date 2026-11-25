#!/bin/zsh
# Сборка iOS с виджетом Live Activity и загрузка в TestFlight — без EAS.
# Подпись: автоматическая, команда 745P2ZBQ77. Нужен ОДИН из вариантов:
#   1) в Xcode → Settings → Accounts добавлен Apple ID, у которого есть команда 745P2ZBQ77;
#   2) ключ App Store Connect API (роль Admin или App Manager):
#        ASC_KEY_PATH=~/путь/AuthKey_XXXX.p8 ASC_KEY_ID=XXXX ASC_ISSUER_ID=xxxxxxxx-... ./testflight.sh
set -e
cd "$(dirname "$0")/.."
# Ключ App Store Connect лежит в «Документах» — подставляем сами, ничего вводить не нужно
if [[ -z "$ASC_KEY_PATH" && -f "$HOME/Documents/AuthKey_Q5L2476526.p8" ]]; then
  ASC_KEY_PATH="$HOME/Documents/AuthKey_Q5L2476526.p8"; ASC_KEY_ID=Q5L2476526; ASC_ISSUER_ID=ba34a704-af2d-4c14-bc37-ce3b9b4414c8
fi
AUTH=()
if [[ -n "$ASC_KEY_PATH" ]]; then
  [[ -f "$ASC_KEY_PATH" ]] || { echo "Нет файла ключа: $ASC_KEY_PATH"; exit 1; }
  [[ -n "$ASC_KEY_ID" && -n "$ASC_ISSUER_ID" ]] || { echo "Задайте ASC_KEY_ID и ASC_ISSUER_ID вместе с ASC_KEY_PATH"; exit 1; }
  echo "== Подпись через ключ App Store Connect API ($ASC_KEY_ID)"
else
  echo "== Ключ App Store Connect не передан — подпись через аккаунт в Xcode (если его нет, будет «No Accounts»)"
fi
if [[ -n "$ASC_KEY_PATH" ]]; then
  AUTH=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
fi
ARCHIVE=build-release/KUDAIBERDI.xcarchive
if [[ "$1" == "--upload-only" && -d "$ARCHIVE" ]]; then
  echo "== Архив уже собран — только загрузка"
else
rm -rf build-release
echo "== Архив (10–20 минут)…"
xcodebuild -workspace ios/KUDAIBERDI.xcworkspace -scheme KUDAIBERDI -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates "${AUTH[@]}" archive | grep -E "error:|warning: .*[Ss]ign|\*\* ARCHIVE" || true
[[ -d "$ARCHIVE" ]] || { echo "Архив не собран — смотрите ошибки выше"; exit 1; }
fi
echo "== Загрузка в App Store Connect…"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist ios-release/ExportOptions.plist \
  -exportPath build-release/export -allowProvisioningUpdates "${AUTH[@]}"
echo "Готово: сборка 1.0.5 ($(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" ios/KUDAIBERDI/Info.plist)) появится в TestFlight через 10–30 минут после обработки Apple."

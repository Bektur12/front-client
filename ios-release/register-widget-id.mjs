// Один раз: регистрирует Bundle ID виджета Live Activity в аккаунте Apple через ключ App Store Connect API.
// Запуск — с теми же переменными, что и testflight.sh: ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID.
// Ключ читается локально и используется только для подписи запроса к api.appstoreconnect.apple.com.
import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { homedir } from 'node:os'

const { ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID } = process.env
if (!ASC_KEY_PATH || !ASC_KEY_ID || !ASC_ISSUER_ID) {
	console.error('Задайте ASC_KEY_PATH, ASC_KEY_ID и ASC_ISSUER_ID (export ... как для testflight.sh)')
	process.exit(1)
}
const IDENTIFIER = 'kg.kudaiberdi.app.widget'
const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const unsigned = `${b64({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' })}.${b64({ iss: ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`
const key = readFileSync(ASC_KEY_PATH.replace(/^~/, homedir()), 'utf8')
const signature = createSign('SHA256').update(unsigned).sign({ key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
const headers = { Authorization: `Bearer ${unsigned}.${signature}`, 'Content-Type': 'application/json' }

const found = await (await fetch(`https://api.appstoreconnect.apple.com/v1/bundleIds?filter[identifier]=${IDENTIFIER}`, { headers })).json()
if (found.data?.some((item) => item.attributes.identifier === IDENTIFIER)) {
	console.log(`Уже зарегистрирован: ${IDENTIFIER}`)
	process.exit(0)
}
if (found.errors) {
	console.error('Apple ответил ошибкой:', found.errors.map((e) => `${e.status} ${e.title}: ${e.detail}`).join('; '))
	process.exit(1)
}
const res = await fetch('https://api.appstoreconnect.apple.com/v1/bundleIds', {
	method: 'POST',
	headers,
	body: JSON.stringify({ data: { type: 'bundleIds', attributes: { identifier: IDENTIFIER, name: 'KUDAIBERDI Live Activity', platform: 'IOS' } } }),
})
const body = await res.json()
if (res.ok) console.log(`Зарегистрирован: ${IDENTIFIER}`)
else {
	console.error('Не удалось:', body.errors?.map((e) => `${e.status} ${e.title}: ${e.detail}`).join('; '))
	process.exit(1)
}

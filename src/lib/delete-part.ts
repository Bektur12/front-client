import { Alert } from 'react-native'
import { toast } from '@/components/ui'
import { ApiError } from '@/lib/api'
import { t } from '@/i18n'

/** «Удалить запчасть?» — она пропадает у покупателей насовсем. Из формы и долгим нажатием в «Мои запчасти». */
export function confirmDeletePart(remove: () => Promise<unknown>, onDone?: () => void) {
	Alert.alert(t('Удалить запчасть?'), t('Покупатели больше не увидят её. Вернуть не получится.'), [
		{ text: t('Отмена'), style: 'cancel' },
		{
			text: t('Удалить'),
			style: 'destructive',
			onPress: () =>
				void remove().then(
					() => {
						toast(t('Запчасть удалена'))
						onDone?.()
					},
					(e) =>
						toast(
							e instanceof ApiError && e.status === 403
								? t('Удалить может только владелец бокса')
								: t('Не удалось удалить, попробуйте ещё раз')
						)
				),
		},
	])
}

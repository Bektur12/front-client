import { CatalogScreen } from '@/components/catalog-screen'
import { CENTER_ACTION_ROOM } from '@/components/tab-bar'

/** «Запчасти» tab of the buyer — parts for sale [27]. */
export default function BuyerPartsScreen() {
	return <CatalogScreen floatingRoom={CENTER_ACTION_ROOM} />
}

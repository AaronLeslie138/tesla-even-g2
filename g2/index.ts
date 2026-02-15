import { createTeslaActions } from './main'
import type { AppModule } from '../_shared/app-types'

export const app: AppModule = {
  id: 'tesla',
  name: 'Tesla',
  pageTitle: 'Settings',
  connectLabel: 'Connect Tesla',
  actionLabel: 'Refresh',
  initialStatus: 'Tesla ready',
  createActions: createTeslaActions,
}

export default app

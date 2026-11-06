import type { RouteObject } from 'react-router'
import { BooksPage } from '@/pages/market/books-page'
import { CalendarsPage } from '@/pages/market/calendars-page'
import { InstrumentPage } from '@/pages/market/instrument-page'
import { InstrumentHistoryPage, InstrumentStatsPage } from '@/pages/market/instrument-stats-page'
import { InstrumentsPage } from '@/pages/market/instruments-page'
import { ProductPage, ProductsPage } from '@/pages/market/products-page'

/** Markets module routes. Change State is a dialog, so there is no /instrument-state route. */
export const marketRoutes: RouteObject[] = [
  { path: 'instruments', element: <InstrumentsPage /> },
  { path: 'instrument', element: <InstrumentPage /> },
  { path: 'instrument-stats', element: <InstrumentStatsPage /> },
  { path: 'instrument-history', element: <InstrumentHistoryPage /> },
  { path: 'books', element: <BooksPage /> },
  { path: 'products', element: <ProductsPage /> },
  { path: 'product', element: <ProductPage /> },
  { path: 'calendars', element: <CalendarsPage /> },
]

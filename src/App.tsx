import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AppLayout } from '@/components/app/app-layout'
import { FormSheetHost } from '@/components/form/form-sheet'
import { AskDialogHost } from '@/lib/dialogs'
import { LoginPage } from '@/pages/auth/login-page'
import { FirmDetailPage, FirmEditPage, FirmNewPage } from '@/pages/firms/firm-detail-page'
import { FirmsListPage } from '@/pages/firms/firms-list-page'
import { ApiKeysPage, RecordPage } from '@/pages/firms/record-pages'
import { marketRoutes } from '@/pages/market/routes'

function Root() {
  return (
    <TooltipProvider>
      <Outlet />
      <AskDialogHost />
      <FormSheetHost />
      <Toaster />
    </TooltipProvider>
  )
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <LoginPage /> },
      {
        element: <AppLayout />,
        children: [
          { path: 'firms', element: <FirmsListPage /> },
          { path: 'firm', element: <FirmDetailPage /> },
          { path: 'firm-new', element: <FirmNewPage /> },
          { path: 'firm-edit', element: <FirmEditPage /> },
          { path: 'user', element: <RecordPage kind="users" /> },
          { path: 'account', element: <RecordPage kind="accounts" /> },
          { path: 'service', element: <RecordPage kind="services" /> },
          { path: 'api-key', element: <RecordPage kind="keys" /> },
          { path: 'api-keys', element: <ApiKeysPage /> },
          ...marketRoutes,
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}

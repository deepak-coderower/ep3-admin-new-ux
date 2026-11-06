import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/lib/theme'

function Toaster(props: ToasterProps) {
  const { resolved } = useTheme()
  return (
    <Sonner
      theme={resolved}
      position="top-center"
      visibleToasts={1}
      duration={3600}
      toastOptions={{ classNames: { toast: 'toast', icon: 'toast-icon' } }}
      {...props}
    />
  )
}

export { Toaster }

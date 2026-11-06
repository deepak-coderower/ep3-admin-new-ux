import { SESSION_KEY } from '@/data/config'
import { clearListStates, session, storage } from '@/lib/storage'

export const isSignedIn = () => storage.get(SESSION_KEY) === '1'
export const signIn = () => storage.set(SESSION_KEY, '1')

export function signOut() {
  storage.del(SESSION_KEY)
  session.clear()
  clearListStates()
}

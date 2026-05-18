export interface AppSession {
  userId: string
  role: 'trainee' | 'coach'
  name: string | null
  phone: string
}

const KEY = 'app_session'

export function getSession(): AppSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession(session: AppSession) {
  localStorage.setItem(KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(KEY)
}

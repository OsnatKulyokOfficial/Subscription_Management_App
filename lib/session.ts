export interface AppSession {
  userId: string
  role: 'trainee' | 'coach'
  name: string | null
  phone: string
}

const KEY = 'app_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function getSession(): AppSession | null {
  if (typeof window === 'undefined') return null
  try {
    const match = document.cookie.split('; ').find(row => row.startsWith(KEY + '='))
    if (!match) return null
    return JSON.parse(decodeURIComponent(match.split('=')[1]))
  } catch {
    return null
  }
}

export function setSession(session: AppSession) {
  const value = encodeURIComponent(JSON.stringify(session))
  document.cookie = `${KEY}=${value}; path=/; max-age=${MAX_AGE}; SameSite=Strict`
}

export function clearSession() {
  document.cookie = `${KEY}=; path=/; max-age=0; SameSite=Strict`
}

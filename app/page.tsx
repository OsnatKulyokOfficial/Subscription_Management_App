'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, setSession, clearSession } from '@/lib/session'
import dynamic from 'next/dynamic'

const LogoParticles = dynamic(() => import('@/components/LogoParticles'), { ssr: false })

type Step = 'phone' | 'code' | 'name'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [isCoach, setIsCoach] = useState(false)
  const [step, setStep] = useState<Step>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Lock body scroll on login page
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  // Same device → skip login entirely (unless ?reset in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('reset')) {
      clearSession()
      return
    }
    const session = getSession()
    if (session) {
      router.replace(session.role === 'coach' ? '/coach' : '/trainee')
    }
  }, [])

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    return digits.startsWith('0') ? '+972' + digits.slice(1) : '+' + digits
  }

  const handleLogin = async () => {
    const raw = phone.replace(/\D/g, '')
    if (raw.length < 9) { setError('הכנס מספר טלפון תקין'); return }
    if (step === 'code' && !code.trim()) {
      setError(isCoach ? 'הכנס תעודת זהות' : 'הכנס קוד קבוצה')
      return
    }
    if (step === 'name' && !name.trim()) { setError('הכנס את שמך'); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formatPhone(raw),
          code: code.trim() || undefined,
          name: name.trim() || undefined,
          isCoach,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'שגיאה. נסה שוב.')
        setLoading(false)
        return
      }

      if (data.needsCode) { setStep('code'); setLoading(false); return }
      if (data.needsName) { setStep('name'); setLoading(false); return }

      setSession({ userId: data.userId, role: data.role, name: data.name, phone: data.phone })
      router.push(data.role === 'coach' ? '/coach' : '/trainee')
    } catch {
      setError('שגיאת רשת. נסה שוב.')
      setLoading(false)
    }
  }

  return (
    <main className="h-dvh flex flex-col items-center justify-center px-6 bg-gradient-to-b from-primary-600 to-primary-700 overflow-hidden">
      <div className="w-full max-w-sm">

        <div className="text-center mb-4">
          <div className="relative flex items-center justify-center mx-auto mb-1" style={{ width: 120, height: 120 }}>
            <LogoParticles size={120} />
            <div className="logo-float rounded-full bg-white overflow-hidden relative z-10" style={{ width: 88, height: 88 }}>
              <img src="/logo.jpg" alt="TeamChampions" className="w-full h-full object-cover" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white mb-0.5">TeamChampions</h1>
          <p className="text-primary-200 text-xs">ניהול אימונים מקצועי</p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xl space-y-3">

          {/* מאמן / מתאמן toggle — only on first step */}
          {step === 'phone' && (
            <div className="flex rounded-2xl border-2 border-slate-200 overflow-hidden">
              <button
                onClick={() => setIsCoach(false)}
                className={`flex-1 py-3 font-semibold text-sm transition-colors ${
                  !isCoach ? 'bg-primary-600 text-white' : 'text-slate-500'
                }`}
              >
                מתאמן
              </button>
              <button
                onClick={() => setIsCoach(true)}
                className={`flex-1 py-3 font-semibold text-sm transition-colors ${
                  isCoach ? 'bg-primary-600 text-white' : 'text-slate-500'
                }`}
              >
                מאמן
              </button>
            </div>
          )}

          {/* Phone */}
          <div>
            <label className="text-sm font-medium text-slate-500 mb-1 block">מספר טלפון</label>
            <input
              type="tel"
              inputMode="tel"
              placeholder="050-0000000"
              value={phone}
              onChange={e => { setPhone(e.target.value); setStep('phone'); setError('') }}
              className="w-full text-xl text-center py-3 border-2 border-slate-200 rounded-2xl
                         focus:outline-none focus:border-primary-500 tracking-widest
                         placeholder:text-slate-300"
              dir="ltr"
            />
          </div>

          {/* Code — only for new users */}
          {step === 'code' && (
            <div>
              <label className="text-sm font-medium text-slate-500 mb-1 block">
                {isCoach ? 'תעודת זהות' : 'קוד קבוצה'}
                <span className="text-primary-500 mr-1">(פעם ראשונה בלבד)</span>
              </label>
              <input
                type={isCoach ? 'text' : 'text'}
                inputMode={isCoach ? 'numeric' : 'text'}
                placeholder={isCoach ? '000000000' : 'הכנס קוד'}
                value={code}
                onChange={e => setCode(e.target.value)}
                autoFocus
                className="w-full text-xl text-center py-3 border-2 border-primary-300 rounded-2xl
                           focus:outline-none focus:border-primary-500 tracking-widest
                           placeholder:text-slate-300"
                dir="ltr"
              />
            </div>
          )}

          {/* Name — only for new users */}
          {step === 'name' && (
            <div>
              <label className="text-sm font-medium text-slate-500 mb-1 block">
                השם שלך <span className="text-primary-500">(פעם ראשונה בלבד)</span>
              </label>
              <input
                type="text"
                placeholder="ישראל ישראלי"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
                className="w-full text-xl text-center py-3 border-2 border-primary-300 rounded-2xl
                           focus:outline-none focus:border-primary-500
                           placeholder:text-slate-300"
              />
              <p className="text-xs text-slate-400 text-center mt-1">
                בפעמים הבאות תיכנס עם הטלפון בלבד
              </p>
            </div>
          )}

          {error && <p className="text-danger text-sm text-center">{error}</p>}

          <button onClick={handleLogin} disabled={loading} className="btn-primary !py-3">
            {loading ? 'נכנס...' : step === 'phone' ? 'כניסה ←' : 'המשך ←'}
          </button>
        </div>
      </div>
    </main>
  )
}

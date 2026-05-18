'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase'
import { getSession, clearSession } from '@/lib/session'
import { format, addDays, startOfWeek } from 'date-fns'
import { HEBREW_DAYS } from '@/lib/types'

const InstallBanner = dynamic(() => import('@/components/InstallBanner'), { ssr: false })

export default function CoachDashboard() {
  const [coachName, setCoachName] = useState('')
  const [stats, setStats] = useState({ trainees: 0, todaySessions: 0, todayRegistered: 0 })
  const [todaySessions, setTodaySessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const session = getSession()
      if (!session) { router.push('/'); return }
      if (session.role !== 'coach') { router.push('/trainee'); return }
      setCoachName(session.name ?? 'מאמן')

      try {
        const today = new Date()
        const todayDow = today.getDay()
        const todayStr = format(today, 'yyyy-MM-dd')

        const [{ count: traineeCount }, { data: sessions }, { data: onetimeSessions }] =
          await Promise.all([
            supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'trainee'),
            supabase.from('sessions').select('*, group:groups(name, color)').eq('day_of_week', todayDow).eq('is_recurring', true).eq('is_cancelled', false),
            supabase.from('sessions').select('*, group:groups(name, color)').eq('session_date', todayStr).eq('is_recurring', false).eq('is_cancelled', false),
          ])

        const allToday = [...(sessions ?? []), ...(onetimeSessions ?? [])]
        setTodaySessions(allToday)

        let regCount = 0
        if (allToday.length) {
          const { count } = await supabase
            .from('registrations')
            .select('id', { count: 'exact', head: true })
            .in('session_id', allToday.map(s => s.id))
            .eq('occurrence_date', todayStr)
          regCount = count ?? 0
        }

        setStats({ trainees: traineeCount ?? 0, todaySessions: allToday.length, todayRegistered: regCount })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const logout = () => {
    clearSession()
    router.push('/')
  }

  const today = new Date()

  if (loading) {
    return (
      <main className="page items-center justify-center">
        <div className="text-4xl animate-bounce">🏋️</div>
        <p className="text-slate-400 mt-3">טוען...</p>
      </main>
    )
  }

  return (
    <main>
      {/* Header */}
      <header className="bg-primary-600 text-white px-5 pt-12 pb-8">
        <div className="max-w-2xl mx-auto flex justify-between items-start">
          <div>
            <p className="text-primary-200 text-sm">מאמן 🏆</p>
            <h1 className="text-2xl font-bold mt-1">{coachName}</h1>
            <p className="text-primary-200 text-sm mt-1">
              {HEBREW_DAYS[today.getDay()]}, {format(today, 'dd/MM/yyyy')}
            </p>
          </div>
          <button onClick={logout} className="text-primary-200 text-sm py-1 px-3 rounded-xl border border-primary-400">
            יציאה
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mt-6 max-w-2xl mx-auto">
          <div className="flex-1 bg-primary-500 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold">{stats.trainees}</p>
            <p className="text-primary-200 text-xs mt-0.5">מתאמנים</p>
          </div>
          <div className="flex-1 bg-primary-500 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold">{stats.todaySessions}</p>
            <p className="text-primary-200 text-xs mt-0.5">אימונים היום</p>
          </div>
          <div className="flex-1 bg-primary-500 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold">{stats.todayRegistered}</p>
            <p className="text-primary-200 text-xs mt-0.5">נרשמו היום</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        <InstallBanner />

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/coach/attendance"
            className="card flex flex-col items-center py-5 active:scale-95 transition-transform text-center">
            <span className="text-3xl mb-2">✅</span>
            <span className="font-semibold text-slate-700">סמן נוכחות</span>
            <span className="text-xs text-slate-400 mt-0.5">אימון של היום</span>
          </Link>
          <Link href="/coach/sessions"
            className="card flex flex-col items-center py-5 active:scale-95 transition-transform text-center">
            <span className="text-3xl mb-2">➕</span>
            <span className="font-semibold text-slate-700">הוסף אימון</span>
            <span className="text-xs text-slate-400 mt-0.5">חד פעמי / קבוע</span>
          </Link>
          <Link href="/coach/groups"
            className="card flex flex-col items-center py-5 active:scale-95 transition-transform text-center">
            <span className="text-3xl mb-2">👥</span>
            <span className="font-semibold text-slate-700">ניהול קבוצות</span>
            <span className="text-xs text-slate-400 mt-0.5">העבר מתאמנים</span>
          </Link>
          <Link href="/coach/reports"
            className="card flex flex-col items-center py-5 active:scale-95 transition-transform text-center">
            <span className="text-3xl mb-2">📊</span>
            <span className="font-semibold text-slate-700">דוחות חודשיים</span>
            <span className="text-xs text-slate-400 mt-0.5">נוכחות ומעקב</span>
          </Link>
        </div>

        {/* Today sessions */}
        {todaySessions.length > 0 && (
          <div>
            <h2 className="font-bold text-slate-700 mb-3">אימונים היום</h2>
            <div className="space-y-2">
              {todaySessions.map(s => (
                <div key={s.id} className="card flex items-center gap-3 border-r-4"
                  style={{ borderRightColor: s.group?.color ?? '#6366f1' }}>
                  <div className="text-2xl font-bold text-slate-700 min-w-[52px]">
                    {s.session_time.slice(0, 5)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{s.group?.name}</p>
                  </div>
                  <Link href="/coach/attendance"
                    className="mr-auto text-sm bg-primary-50 text-primary-600 px-3 py-1.5 rounded-xl font-medium">
                    סמן נוכחות
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {todaySessions.length === 0 && (
          <div className="card text-center py-8 text-slate-400">
            <p className="text-4xl mb-2">😴</p>
            <p className="font-medium">אין אימונים היום</p>
          </div>
        )}
      </div>
    </main>
  )
}

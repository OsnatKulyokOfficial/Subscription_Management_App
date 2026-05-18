'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { getSession, clearSession } from '@/lib/session'
import { Session, Registration, User, HEBREW_DAYS } from '@/lib/types'
import {
  format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO
} from 'date-fns'
import dynamic from 'next/dynamic'

const NotificationSetup = dynamic(() => import('@/components/NotificationSetup'), { ssr: false })

interface SessionWithReg extends Session {
  registration?: Registration
  groupName?: string
  groupColor?: string
}

export default function TraineePage() {
  const [user, setUser] = useState<User | null>(null)
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  )
  const [schedule, setSchedule] = useState<Record<number, SessionWithReg[]>>({})
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const session = getSession()
    if (!session) { router.push('/'); return }
    if (session.role === 'coach') { router.push('/coach'); return }

    try {
      const { data: userRow } = await supabase
        .from('users').select('*').eq('id', session.userId).single()
      if (!userRow) { clearSession(); router.push('/'); return }
      setUser(userRow)

      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id, group:groups(id, name, color)')
        .eq('user_id', session.userId)

      if (!userGroups?.length) { setSchedule({}); return }

      const groupIds = userGroups.map(ug => ug.group_id)
      const groupMap: Record<string, { name: string; color: string }> = {}
      userGroups.forEach((ug: any) => { if (ug.group) groupMap[ug.group_id] = ug.group })

      const { data: sessions } = await supabase
        .from('sessions').select('*').in('group_id', groupIds).eq('is_cancelled', false)

      if (!sessions) { setSchedule({}); return }

      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
      const occurrenceDates = weekDays.map(d => format(d, 'yyyy-MM-dd'))

      const { data: regs } = await supabase
        .from('registrations').select('*')
        .eq('user_id', session.userId)
        .in('occurrence_date', occurrenceDates)

      const regMap: Record<string, Registration> = {}
      regs?.forEach(r => { regMap[`${r.session_id}_${r.occurrence_date}`] = r })

      const byDay: Record<number, SessionWithReg[]> = {}
      for (let i = 0; i < 7; i++) byDay[i] = []

      sessions.forEach(s => {
        const g = groupMap[s.group_id]
        if (s.is_recurring && s.day_of_week != null) {
          const occDate = occurrenceDates[s.day_of_week]
          byDay[s.day_of_week].push({ ...s, registration: regMap[`${s.id}_${occDate}`], groupName: g?.name, groupColor: g?.color })
        } else if (!s.is_recurring && s.session_date) {
          const dayIdx = weekDays.findIndex(d => isSameDay(d, parseISO(s.session_date!)))
          if (dayIdx >= 0) byDay[dayIdx].push({ ...s, registration: regMap[`${s.id}_${s.session_date}`], groupName: g?.name, groupColor: g?.color })
        }
      })

      Object.keys(byDay).forEach(d => {
        byDay[Number(d)].sort((a, b) => a.session_time.localeCompare(b.session_time))
      })

      setSchedule(byDay)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [weekStart, router])

  useEffect(() => { loadData() }, [loadData])

  const toggleRegistration = async (session: SessionWithReg, dayIdx: number) => {
    if (!user) return
    const occDate = format(addDays(weekStart, dayIdx), 'yyyy-MM-dd')
    const key = `${session.id}_${occDate}`
    setToggling(key)

    if (session.registration) {
      await supabase
        .from('registrations')
        .delete()
        .eq('id', session.registration.id)
    } else {
      await supabase.from('registrations').insert({
        user_id: user.id,
        session_id: session.id,
        occurrence_date: occDate,
      })
    }

    await loadData()
    setToggling(null)
  }

  const logout = () => {
    clearSession()
    router.push('/')
  }

  const today = new Date()
  const todayDayIdx = today.getDay()

  if (loading) {
    return (
      <main className="page items-center justify-center">
        <div className="text-4xl animate-bounce">🏋️</div>
        <p className="text-slate-400 mt-3">טוען...</p>
      </main>
    )
  }

  return (
    <main className="page">
      {/* Header */}
      <header className="bg-primary-600 text-white px-5 pt-12 pb-6">
        <div className="flex justify-between items-start max-w-md mx-auto">
          <div>
            <p className="text-primary-200 text-sm mb-1">שלום 👋</p>
            <h1 className="text-2xl font-bold">{user?.name ?? 'מתאמן יקר'}</h1>
          </div>
          <button onClick={logout} className="text-primary-200 text-sm py-1 px-3 rounded-xl border border-primary-400">
            יציאה
          </button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between mt-5 max-w-md mx-auto">
          <button
            onClick={() => setWeekStart(w => subWeeks(w, 1))}
            className="w-10 h-10 rounded-full bg-primary-500 text-xl flex items-center justify-center"
          >
            ›
          </button>
          <span className="font-semibold text-base">
            {format(weekStart, 'dd/MM')} – {format(addDays(weekStart, 6), 'dd/MM')}
          </span>
          <button
            onClick={() => setWeekStart(w => addWeeks(w, 1))}
            className="w-10 h-10 rounded-full bg-primary-500 text-xl flex items-center justify-center"
          >
            ‹
          </button>
        </div>
      </header>

      {/* Sessions */}
      {user && <NotificationSetup userId={user.id} />}

      <div className="flex-1 px-4 py-5 max-w-md mx-auto w-full space-y-3">
        {Array.from({ length: 7 }, (_, i) => i).map(dayIdx => {
          const sessions = schedule[dayIdx] ?? []
          const dayDate = addDays(weekStart, dayIdx)
          const isToday = isSameDay(dayDate, today)

          return (
            <div key={dayIdx}>
              {/* Day header — show only if has sessions or is today */}
              {(sessions.length > 0 || isToday) && (
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <span
                    className={`text-sm font-bold px-3 py-1 rounded-full ${
                      isToday
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {HEBREW_DAYS[dayIdx]} {format(dayDate, 'dd/MM')}
                  </span>
                  {isToday && <span className="text-xs text-primary-500 font-medium">היום</span>}
                </div>
              )}

              {sessions.map(session => {
                const occKey = `${session.id}_${format(dayDate, 'yyyy-MM-dd')}`
                const isRegistered = !!session.registration
                const isLoading = toggling === occKey

                return (
                  <div
                    key={session.id}
                    className={`card flex items-center justify-between mb-2 border-r-4 transition-all`}
                    style={{ borderRightColor: session.groupColor ?? '#6366f1' }}
                  >
                    <div>
                      <p className="text-lg font-bold text-slate-800">
                        {session.session_time.slice(0, 5)}
                      </p>
                      <p className="text-sm text-slate-500">{session.groupName}</p>
                    </div>
                    <button
                      onClick={() => toggleRegistration(session, dayIdx)}
                      disabled={isLoading}
                      className={`py-3 px-6 rounded-2xl text-base font-bold transition-all active:scale-95 min-w-[100px] ${
                        isRegistered
                          ? 'bg-success text-white shadow-sm'
                          : 'border-2 border-slate-200 text-slate-500 bg-white'
                      }`}
                    >
                      {isLoading ? '...' : isRegistered ? '✓ מגיע' : 'מגיע?'}
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })}

        {Object.values(schedule).every(s => s.length === 0) && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-lg font-medium">אין אימונים השבוע</p>
            <p className="text-sm mt-1">פנה למאמן להצטרפות לקבוצה</p>
          </div>
        )}
      </div>
    </main>
  )
}

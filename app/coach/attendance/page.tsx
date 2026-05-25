'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format, addDays, subDays } from 'date-fns'
import { HEBREW_DAYS } from '@/lib/types'
import { useTraineeHistory } from '@/contexts/TraineeHistoryContext'

interface AttendeeRow {
  userId: string
  name: string | null
  phone: string
  registrationId: string | null
  attended: boolean | null
}

export default function AttendancePage() {
  const { openHistory } = useTraineeHistory()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [attendees, setAttendees] = useState<AttendeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const supabase = createClient()

  const loadSessions = async (d: string) => {
    setLoading(true)
    setSelectedSession(null)
    setAttendees([])

    const dateObj = new Date(d + 'T12:00:00')
    const dow = dateObj.getDay()

    const [{ data: recurring }, { data: onetime }] = await Promise.all([
      supabase
        .from('sessions')
        .select('*, group:groups(*)')
        .eq('day_of_week', dow)
        .eq('is_recurring', true)
        .eq('is_cancelled', false),
      supabase
        .from('sessions')
        .select('*, group:groups(*)')
        .eq('session_date', d)
        .eq('is_recurring', false)
        .eq('is_cancelled', false),
    ])

    const all = [...(recurring ?? []), ...(onetime ?? [])]
      .sort((a, b) => a.session_time.localeCompare(b.session_time))
    setSessions(all)

    if (all.length === 1) {
      await loadAttendees(all[0].id, all[0].group_id, d)
      setSelectedSession(all[0].id)
    }
    setLoading(false)
  }

  const loadAttendees = async (sessionId: string, groupId: string, d: string) => {
    // Get all trainees in this group
    const { data: ug } = await supabase
      .from('user_groups')
      .select('user_id, user:users(id, name, phone)')
      .eq('group_id', groupId)

    const trainees = (ug ?? []).map((u: any) => u.user).filter(Boolean)

    // Get registrations for this session on this date
    const { data: regs } = await supabase
      .from('registrations')
      .select('*')
      .eq('session_id', sessionId)
      .eq('occurrence_date', d)

    const regMap: Record<string, any> = {}
    regs?.forEach(r => { regMap[r.user_id] = r })

    const rows: AttendeeRow[] = trainees.map((t: any) => ({
      userId: t.id,
      name: t.name,
      phone: t.phone,
      registrationId: regMap[t.id]?.id ?? null,
      attended: regMap[t.id]?.attended ?? null,
    }))

    // Sort: registered first, then alphabetically
    rows.sort((a, b) => {
      if (a.registrationId && !b.registrationId) return -1
      if (!a.registrationId && b.registrationId) return 1
      return (a.name ?? a.phone).localeCompare(b.name ?? b.phone)
    })

    setAttendees(rows)
  }

  const selectSession = async (sessionId: string) => {
    setSelectedSession(sessionId)
    const s = sessions.find(x => x.id === sessionId)
    if (s) await loadAttendees(sessionId, s.group_id, date)
  }

  useEffect(() => { loadSessions(date) }, [date])

  const markAttendance = async (row: AttendeeRow, attended: boolean | null) => {
    setToggling(row.userId)
    const s = sessions.find(x => x.id === selectedSession)
    if (!s) { setToggling(null); return }

    if (row.registrationId) {
      if (attended === null) {
        await supabase.from('registrations').delete().eq('id', row.registrationId)
      } else {
        await supabase.from('registrations').update({ attended }).eq('id', row.registrationId)
      }
    } else if (attended !== null) {
      await supabase.from('registrations').insert({
        user_id: row.userId,
        session_id: selectedSession,
        occurrence_date: date,
        attended,
      })
    }

    await loadAttendees(selectedSession!, s.group_id, date)
    setToggling(null)
  }

  const registeredCount = attendees.filter(a => a.registrationId).length
  const attendedCount = attendees.filter(a => a.attended === true).length
  const dateObj = new Date(date + 'T12:00:00')

  return (
    <main>
      <header className="bg-primary-600 text-white px-5 pt-12 pb-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">סימון נוכחות</h1>

          {/* Date selector */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => setDate(format(subDays(dateObj, 1), 'yyyy-MM-dd'))}
              className="w-10 h-10 rounded-full bg-primary-500 text-xl flex items-center justify-center"
            >
              ›
            </button>
            <div className="flex-1 text-center">
              <p className="font-bold">{HEBREW_DAYS[dateObj.getDay()]}</p>
              <p className="text-primary-200 text-sm">{format(dateObj, 'dd/MM/yyyy')}</p>
            </div>
            <button
              onClick={() => setDate(format(addDays(dateObj, 1), 'yyyy-MM-dd'))}
              className="w-10 h-10 rounded-full bg-primary-500 text-xl flex items-center justify-center"
            >
              ‹
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* Session selector */}
        {sessions.length > 1 && (
          <div className="space-y-2">
            <h2 className="font-semibold text-slate-600 text-sm">בחר אימון:</h2>
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => selectSession(s.id)}
                className={`w-full card text-right flex items-center justify-between transition-all ${
                  selectedSession === s.id ? 'ring-2 ring-primary-500' : ''
                }`}
              >
                <div>
                  <p className="font-bold text-slate-800">{s.session_time.slice(0, 5)}</p>
                  <p className="text-sm text-slate-500">{s.group?.name}</p>
                </div>
                {selectedSession === s.id && <span className="text-primary-600 font-bold">✓</span>}
              </button>
            ))}
          </div>
        )}

        {sessions.length === 0 && !loading && (
          <div className="card text-center py-10 text-slate-400">
            <p className="text-4xl mb-2">📅</p>
            <p>אין אימונים בתאריך זה</p>
          </div>
        )}

        {/* Attendance list */}
        {selectedSession && attendees.length > 0 && (
          <>
            {/* Summary bar */}
            <div className="flex gap-3">
              <div className="flex-1 bg-blue-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{registeredCount}</p>
                <p className="text-xs text-blue-400">נרשמו</p>
              </div>
              <div className="flex-1 bg-green-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-success">{attendedCount}</p>
                <p className="text-xs text-green-400">הגיעו</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-2xl p-3 text-center">
                <p className="text-2xl font-bold text-slate-600">{attendees.length}</p>
                <p className="text-xs text-slate-400">בקבוצה</p>
              </div>
            </div>

            <h2 className="font-semibold text-slate-700">רשימת מתאמנים</h2>

            <div className="space-y-2">
              {attendees.map(row => (
                <div key={row.userId}
                  className={`card flex items-center gap-3 ${!row.registrationId ? 'opacity-60' : ''}`}>
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                    {(row.name ?? row.phone).slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0"
                    onClick={() => openHistory({ id: row.userId, name: row.name, phone: row.phone, role: 'trainee', created_at: '' })}>
                    <p className="font-semibold text-slate-800 truncate cursor-pointer">
                      {row.name ?? 'ללא שם'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {row.registrationId ? '✓ נרשם' : '— לא נרשם'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      disabled={toggling === row.userId}
                      onClick={() => markAttendance(row, row.attended === true ? null : true)}
                      className={`w-11 h-11 rounded-xl font-bold text-lg transition-all active:scale-90 ${
                        row.attended === true
                          ? 'bg-success text-white shadow-sm'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      ✓
                    </button>
                    <button
                      disabled={toggling === row.userId}
                      onClick={() => markAttendance(row, row.attended === false ? null : false)}
                      className={`w-11 h-11 rounded-xl font-bold text-lg transition-all active:scale-90 ${
                        row.attended === false
                          ? 'bg-danger text-white shadow-sm'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {selectedSession && attendees.length === 0 && !loading && (
          <div className="card text-center py-10 text-slate-400">
            <p className="text-4xl mb-2">👤</p>
            <p>אין מתאמנים בקבוצה זו</p>
          </div>
        )}
      </div>
    </main>
  )
}

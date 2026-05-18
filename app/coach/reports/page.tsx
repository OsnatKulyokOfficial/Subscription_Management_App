'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns'
import { useTraineeHistory } from '@/contexts/TraineeHistoryContext'

interface TraineeReport {
  userId: string
  name: string | null
  phone: string
  groupName: string
  registered: number
  attended: number
  rate: number
}

export default function ReportsPage() {
  const { openHistory } = useTraineeHistory()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [report, setReport] = useState<TraineeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'low'>('all')
  const supabase = createClient()

  const loadReport = async (y: number, m: number) => {
    setLoading(true)

    const monthStart = startOfMonth(new Date(y, m - 1, 1))
    const monthEnd = endOfMonth(monthStart)
    const startStr = format(monthStart, 'yyyy-MM-dd')
    const endStr = format(monthEnd, 'yyyy-MM-dd')

    // Get all trainees with their groups
    const { data: ug } = await supabase
      .from('user_groups')
      .select('user_id, group_id, user:users(id, name, phone), group:groups(name)')

    if (!ug?.length) { setReport([]); setLoading(false); return }

    // Get all sessions in this month (recurring: compute occurrences; one-time: filter by date)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*')
      .eq('is_cancelled', false)

    // Build occurrence dates per session within the month
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
    const sessionOccurrences: Record<string, string[]> = {}
    sessions?.forEach(s => {
      const dates: string[] = []
      if (s.is_recurring && s.day_of_week != null) {
        days.forEach(d => {
          if (getDay(d) === s.day_of_week) dates.push(format(d, 'yyyy-MM-dd'))
        })
      } else if (!s.is_recurring && s.session_date >= startStr && s.session_date <= endStr) {
        dates.push(s.session_date)
      }
      sessionOccurrences[s.id] = dates
    })

    // Get all registrations in this month
    const { data: regs } = await supabase
      .from('registrations')
      .select('*')
      .gte('occurrence_date', startStr)
      .lte('occurrence_date', endStr)

    // Build report per trainee
    const reportMap: Record<string, TraineeReport> = {}
    ug.forEach((row: any) => {
      if (!row.user) return
      if (!reportMap[row.user_id]) {
        reportMap[row.user_id] = {
          userId: row.user_id,
          name: row.user.name,
          phone: row.user.phone,
          groupName: row.group?.name ?? '—',
          registered: 0,
          attended: 0,
          rate: 0,
        }
      }
    })

    // Count sessions available per group
    const groupSessionCount: Record<string, number> = {}
    sessions?.forEach(s => {
      const count = sessionOccurrences[s.id]?.length ?? 0
      groupSessionCount[s.group_id] = (groupSessionCount[s.group_id] ?? 0) + count
    })

    regs?.forEach(r => {
      if (reportMap[r.user_id]) {
        reportMap[r.user_id].registered += 1
        if (r.attended === true) reportMap[r.user_id].attended += 1
      }
    })

    const finalReport = Object.values(reportMap).map(r => ({
      ...r,
      rate: r.registered > 0 ? Math.round((r.attended / r.registered) * 100) : 0,
    })).sort((a, b) => (b.attended - a.attended))

    setReport(finalReport)
    setLoading(false)
  }

  useEffect(() => { loadReport(year, month) }, [year, month])

  const months = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ]

  const displayed = filter === 'low' ? report.filter(r => r.rate < 50 && r.registered > 0) : report
  const active = report.filter(r => r.registered > 0)
  const avgRate = active.length
    ? Math.round(active.reduce((s, r) => s + r.rate, 0) / active.length)
    : 0

  return (
    <main>
      <header className="bg-primary-600 text-white px-5 pt-12 pb-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">דוחות חודשיים</h1>

          {/* Month/Year selector */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                if (month === 1) { setMonth(12); setYear(y => y - 1) }
                else setMonth(m => m - 1)
              }}
              className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-xl"
            >
              ›
            </button>
            <p className="flex-1 text-center font-bold text-lg">
              {months[month - 1]} {year}
            </p>
            <button
              onClick={() => {
                if (month === 12) { setMonth(1); setYear(y => y + 1) }
                else setMonth(m => m + 1)
              }}
              className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-xl"
            >
              ‹
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">
        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <p className="text-2xl font-bold text-primary-600">{report.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">מתאמנים</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-success">
                {report.reduce((s, r) => s + r.attended, 0)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">הגיעו סה"כ</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-slate-700">{avgRate}%</p>
              <p className="text-xs text-slate-400 mt-0.5">ממוצע נוכחות</p>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex rounded-2xl border-2 border-slate-200 overflow-hidden">
          <button
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${filter === 'all' ? 'bg-primary-600 text-white' : 'text-slate-500'}`}
            onClick={() => setFilter('all')}
          >
            כולם
          </button>
          <button
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${filter === 'low' ? 'bg-primary-600 text-white' : 'text-slate-500'}`}
            onClick={() => setFilter('low')}
          >
            ⚠️ נוכחות נמוכה
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-3xl animate-bounce">📊</p>
            <p className="mt-2">טוען...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="card text-center py-10 text-slate-400">
            <p className="text-4xl mb-2">📭</p>
            <p>אין נתונים לחודש זה</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(r => (
              <div key={r.userId} className="card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center font-bold text-primary-600 flex-shrink-0">
                    {(r.name ?? r.phone).slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0"
                    onClick={() => openHistory({ id: r.userId, name: r.name, phone: r.phone, role: 'trainee', created_at: '' })}>
                    <p className="font-semibold text-slate-800 truncate cursor-pointer">{r.name ?? 'ללא שם'}</p>
                    <p className="text-xs text-slate-400">{r.groupName}</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className={`text-lg font-bold ${
                      r.rate >= 80 ? 'text-success' :
                      r.rate >= 50 ? 'text-amber-500' : 'text-danger'
                    }`}>
                      {r.attended}/{r.registered}
                    </p>
                    <p className="text-xs text-slate-400 text-left">{r.rate}%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      r.rate >= 80 ? 'bg-success' :
                      r.rate >= 50 ? 'bg-amber-400' : 'bg-danger'
                    }`}
                    style={{ width: `${r.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

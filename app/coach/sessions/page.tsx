'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Session, Group, HEBREW_DAYS } from '@/lib/types'
import { sendPush } from '@/lib/push'
import { format } from 'date-fns'

interface SessionWithGroup extends Session {
  group?: Group
}

const EMPTY_FORM = {
  group_id: '',
  day_of_week: 0,
  session_time: '17:00',
  is_recurring: true,
  session_date: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionWithGroup[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editSession, setEditSession] = useState<SessionWithGroup | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const [{ data: s }, { data: g }] = await Promise.all([
      supabase.from('sessions').select('*, group:groups(*)').order('session_time'),
      supabase.from('groups').select('*').order('name'),
    ])
    setSessions(s ?? [])
    setGroups(g ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, group_id: groups[0]?.id ?? '' })
    setEditSession(null)
    setShowForm(true)
  }

  const openEdit = (s: SessionWithGroup) => {
    setEditSession(s)
    setForm({
      group_id: s.group_id,
      day_of_week: s.day_of_week ?? 0,
      session_time: s.session_time.slice(0, 5),
      is_recurring: s.is_recurring,
      session_date: s.session_date ?? format(new Date(), 'yyyy-MM-dd'),
      notes: s.notes ?? '',
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.group_id) return
    setSaving(true)

    const payload = {
      group_id: form.group_id,
      session_time: form.session_time,
      is_recurring: form.is_recurring,
      day_of_week: form.is_recurring ? form.day_of_week : null,
      session_date: !form.is_recurring ? form.session_date : null,
      notes: form.notes || null,
    }

    if (editSession) {
      await supabase.from('sessions').update(payload).eq('id', editSession.id)

      // Notify trainees in that group about the change
      const { data: ug } = await supabase
        .from('user_groups')
        .select('user_id')
        .eq('group_id', form.group_id)

      if (ug?.length) {
        const group = groups.find(g => g.id === form.group_id)
        const msg = `שעת האימון של ${group?.name} שונתה ל-${form.session_time}`
        const ids = ug.map(u => u.user_id)
        await Promise.all([
          sendPush(ids, '🕐 שינוי שעה', msg),
          supabase.from('notifications_log').insert(
            ids.map(uid => ({ user_id: uid, message: msg, type: 'session_changed' }))
          ),
        ])
      }
    } else {
      await supabase.from('sessions').insert(payload)
    }

    setShowForm(false)
    setSaving(false)
    await load()
  }

  const cancelSession = async (s: SessionWithGroup) => {
    await supabase.from('sessions').update({ is_cancelled: true }).eq('id', s.id)

    const { data: ug } = await supabase
      .from('user_groups')
      .select('user_id')
      .eq('group_id', s.group_id)

    if (ug?.length) {
      const dayLabel = s.is_recurring ? `יום ${HEBREW_DAYS[s.day_of_week!]}` : s.session_date
      const msg = `האימון של ${s.group?.name} (${dayLabel} ${s.session_time.slice(0, 5)}) בוטל`
      const ids = ug.map(u => u.user_id)
      await Promise.all([
        sendPush(ids, '❌ אימון בוטל', msg),
        supabase.from('notifications_log').insert(
          ids.map(uid => ({ user_id: uid, message: msg, type: 'session_cancelled' }))
        ),
      ])
    }

    await load()
  }

  const restoreSession = async (id: string) => {
    await supabase.from('sessions').update({ is_cancelled: false }).eq('id', id)
    await load()
  }

  const deleteSession = async (id: string) => {
    if (!confirm('למחוק את האימון לצמיתות?')) return
    await supabase.from('sessions').delete().eq('id', id)
    await load()
  }

  const recurring = sessions.filter(s => s.is_recurring && !s.is_cancelled)
  const onetime = sessions.filter(s => !s.is_recurring && !s.is_cancelled)
  const cancelled = sessions.filter(s => s.is_cancelled)

  return (
    <main>
      <header className="bg-primary-600 text-white px-5 pt-12 pb-6">
        <div className="max-w-2xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">ניהול אימונים</h1>
            <p className="text-primary-200 text-sm mt-1">{sessions.filter(s => !s.is_cancelled).length} אימונים פעילים</p>
          </div>
          <button onClick={openAdd} className="bg-white text-primary-600 font-bold px-4 py-2 rounded-xl text-sm">
            ➕ הוסף
          </button>
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-5">
        {/* Recurring sessions by day */}
        {[0, 1, 2, 3, 4, 5, 6].map(day => {
          const daySessions = recurring.filter(s => s.day_of_week === day)
          if (!daySessions.length) return null
          return (
            <div key={day}>
              <h2 className="font-bold text-slate-600 mb-2 text-sm">{HEBREW_DAYS[day]}</h2>
              <div className="space-y-2">
                {daySessions.map(s => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onEdit={() => openEdit(s)}
                    onCancel={() => cancelSession(s)}
                    onDelete={() => deleteSession(s.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {/* One-time sessions */}
        {onetime.length > 0 && (
          <div>
            <h2 className="font-bold text-slate-600 mb-2 text-sm">אימונים חד פעמיים</h2>
            <div className="space-y-2">
              {onetime.map(s => (
                <SessionCard
                  key={s.id}
                  session={s}
                  onEdit={() => openEdit(s)}
                  onCancel={() => cancelSession(s)}
                  onDelete={() => deleteSession(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Cancelled */}
        {cancelled.length > 0 && (
          <div>
            <h2 className="font-bold text-slate-400 mb-2 text-sm">מבוטלים</h2>
            <div className="space-y-2">
              {cancelled.map(s => (
                <div key={s.id} className="card opacity-50 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium line-through text-slate-500">
                      {s.is_recurring ? HEBREW_DAYS[s.day_of_week!] : s.session_date} – {s.session_time.slice(0, 5)}
                    </p>
                    <p className="text-xs text-slate-400">{s.group?.name}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => restoreSession(s.id)}
                      className="text-xs text-success border border-success px-2 py-1 rounded-lg">
                      שחזר
                    </button>
                    <button onClick={() => deleteSession(s.id)}
                      className="text-xs text-danger border border-danger px-2 py-1 rounded-lg">
                      מחק
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 && !loading && (
          <div className="card text-center py-10 text-slate-400">
            <p className="text-4xl mb-2">📅</p>
            <p>אין אימונים עדיין. הוסף את הראשון!</p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-4 pb-10">
            <h2 className="text-xl font-bold text-slate-800">
              {editSession ? 'עריכת אימון' : 'אימון חדש'}
            </h2>

            {/* Group */}
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">קבוצה</label>
              <select
                value={form.group_id}
                onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-400"
              >
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {/* Recurring toggle */}
            <div className="flex rounded-2xl border-2 border-slate-200 overflow-hidden">
              <button
                className={`flex-1 py-3 font-semibold transition-colors ${form.is_recurring ? 'bg-primary-600 text-white' : 'text-slate-500'}`}
                onClick={() => setForm(f => ({ ...f, is_recurring: true }))}
              >
                שבועי קבוע
              </button>
              <button
                className={`flex-1 py-3 font-semibold transition-colors ${!form.is_recurring ? 'bg-primary-600 text-white' : 'text-slate-500'}`}
                onClick={() => setForm(f => ({ ...f, is_recurring: false }))}
              >
                חד פעמי
              </button>
            </div>

            {/* Day or Date */}
            {form.is_recurring ? (
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">יום בשבוע</label>
                <div className="flex flex-wrap gap-2">
                  {HEBREW_DAYS.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => setForm(f => ({ ...f, day_of_week: i }))}
                      className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        form.day_of_week === i
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-slate-600 mb-1 block">תאריך</label>
                <input
                  type="date"
                  value={form.session_date}
                  onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-400"
                />
              </div>
            )}

            {/* Time */}
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">שעה</label>
              <input
                type="time"
                value={form.session_time}
                onChange={e => setForm(f => ({ ...f, session_time: e.target.value }))}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-400"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">הערות (אופציונלי)</label>
              <input
                type="text"
                placeholder="הערה קצרה..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-400"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={save} disabled={saving} className="flex-1 btn-primary py-3">
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 btn-ghost py-3">
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function SessionCard({
  session,
  onEdit,
  onCancel,
  onDelete,
}: {
  session: SessionWithGroup
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="card border-r-4 cursor-pointer active:scale-[0.98] transition-transform"
      style={{ borderRightColor: session.group?.color ?? '#6366f1' }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-800 text-lg">{session.session_time.slice(0, 5)}</p>
          <p className="text-sm text-slate-500">{session.group?.name}</p>
          {session.notes && <p className="text-xs text-slate-400 mt-0.5">{session.notes}</p>}
        </div>
        <span className="text-slate-400 text-xl">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          <button onClick={e => { e.stopPropagation(); onEdit() }}
            className="flex-1 bg-primary-50 text-primary-600 font-semibold py-2 rounded-xl text-sm">
            עריכה
          </button>
          <button onClick={e => { e.stopPropagation(); onCancel() }}
            className="flex-1 bg-orange-50 text-orange-500 font-semibold py-2 rounded-xl text-sm">
            ביטול אימון
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}
            className="bg-red-50 text-danger font-semibold py-2 px-3 rounded-xl text-sm">
            🗑
          </button>
        </div>
      )}
    </div>
  )
}

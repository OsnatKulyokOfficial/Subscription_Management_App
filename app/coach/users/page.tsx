'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@/lib/types'
import { useTraineeHistory } from '@/contexts/TraineeHistoryContext'

export default function UsersPage() {
  const { openHistory } = useTraineeHistory()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<'trainee' | 'coach'>('trainee')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const addUser = async () => {
    const raw = newPhone.replace(/\D/g, '')
    if (raw.length < 9) return
    if (!newName.trim()) return
    setSaving(true)
    const phone = raw.startsWith('0') ? '+972' + raw.slice(1) : '+' + raw
    await supabase.from('users').insert({ phone, name: newName.trim(), role: newRole, is_active: true })
    setNewPhone(''); setNewName(''); setNewRole('trainee')
    setShowAdd(false); setSaving(false)
    await load()
  }

  const deactivateUser = async (id: string, name: string | null) => {
    if (!confirm(`להסיר את ${name ?? 'המשתמש'} מהרשימה הפעילה?\nהנתונים שלו יישמרו במערכת.`)) return
    await supabase.from('users').update({ is_active: false }).eq('id', id)
    await load()
  }

  const reactivateUser = async (id: string) => {
    await supabase.from('users').update({ is_active: true }).eq('id', id)
    await load()
  }

  const changeRole = async (id: string, role: 'trainee' | 'coach') => {
    await supabase.from('users').update({ role }).eq('id', id)
    setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
  }

  const activeUsers = users.filter(u => u.is_active !== false)
  const inactiveUsers = users.filter(u => u.is_active === false)

  const filtered = activeUsers.filter(u =>
    (u.name ?? '').includes(search) || u.phone.includes(search)
  )
  const trainees = filtered.filter(u => u.role === 'trainee')
  const coaches = filtered.filter(u => u.role === 'coach')

  const filteredInactive = inactiveUsers.filter(u =>
    (u.name ?? '').includes(search) || u.phone.includes(search)
  )

  return (
    <main>
      <header className="bg-primary-600 text-white px-5 pt-12 pb-6">
        <div className="max-w-2xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">משתמשים</h1>
            <p className="text-primary-200 text-sm mt-1">
              {activeUsers.filter(u => u.role === 'trainee').length} מתאמנים · {activeUsers.filter(u => u.role === 'coach').length} מאמנים
            </p>
          </div>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="bg-white text-primary-600 font-bold px-4 py-2 rounded-xl text-sm"
          >
            ➕ הוסף
          </button>
        </div>
        <div className="mt-4 max-w-2xl mx-auto">
          <input
            type="text"
            placeholder="חיפוש לפי שם או טלפון..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-primary-500 text-white placeholder:text-primary-300 rounded-2xl px-4 py-3 text-sm focus:outline-none"
          />
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">

        {showAdd && (
          <div className="card space-y-3">
            <h2 className="font-bold text-slate-800">הוספת משתמש</h2>
            <input type="tel" placeholder="מספר טלפון" value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-400" dir="ltr" />
            <input type="text" placeholder="שם מלא" value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-400" />
            <div className="flex rounded-2xl border-2 border-slate-200 overflow-hidden">
              <button onClick={() => setNewRole('trainee')}
                className={`flex-1 py-3 font-semibold text-sm transition-colors ${newRole === 'trainee' ? 'bg-primary-600 text-white' : 'text-slate-500'}`}>
                מתאמן
              </button>
              <button onClick={() => setNewRole('coach')}
                className={`flex-1 py-3 font-semibold text-sm transition-colors ${newRole === 'coach' ? 'bg-primary-600 text-white' : 'text-slate-500'}`}>
                מאמן
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={addUser} disabled={saving} className="flex-1 btn-primary py-3 text-base">
                {saving ? 'שומר...' : 'הוסף'}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 btn-ghost py-3 text-base">ביטול</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-3xl animate-bounce">👤</p>
            <p className="mt-2">טוען...</p>
          </div>
        ) : (
          <>
            {coaches.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-slate-500 mb-2">מאמנים</h2>
                <div className="space-y-2">
                  {coaches.map(u => (
                    <UserRow key={u.id} user={u} onDeactivate={deactivateUser} onRoleChange={changeRole} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-sm font-bold text-slate-500 mb-2">מתאמנים ({trainees.length})</h2>
              {trainees.length === 0 ? (
                <div className="card text-center py-8 text-slate-400">
                  <p className="text-3xl mb-2">👤</p>
                  <p>אין מתאמנים פעילים</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {trainees.map(u => (
                    <UserRow key={u.id} user={u} onDeactivate={deactivateUser} onRoleChange={changeRole} />
                  ))}
                </div>
              )}
            </div>

            {/* Inactive users */}
            {inactiveUsers.length > 0 && (
              <div>
                <button
                  onClick={() => setShowInactive(v => !v)}
                  className="text-sm text-slate-400 underline w-full text-right"
                >
                  {showInactive ? 'הסתר' : `הצג ${inactiveUsers.length} מתאמנים לא פעילים`}
                </button>

                {showInactive && (
                  <div className="space-y-2 mt-2">
                    {filteredInactive.map(u => (
                      <div key={u.id} className="card opacity-60">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 flex-shrink-0">
                            {(u.name ?? u.phone).slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0" onClick={() => u.role === 'trainee' && openHistory(u)}>
                            <p className="font-semibold text-slate-500 truncate cursor-pointer">{u.name ?? 'ללא שם'}</p>
                            <p className="text-xs text-slate-400 truncate">{u.phone}</p>
                          </div>
                          <button
                            onClick={() => reactivateUser(u.id)}
                            className="text-xs bg-primary-50 text-primary-600 font-semibold px-3 py-1.5 rounded-xl"
                          >
                            החזר לפעילים
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function UserRow({
  user,
  onDeactivate,
  onRoleChange,
}: {
  user: User
  onDeactivate: (id: string, name: string | null) => void
  onRoleChange: (id: string, role: 'trainee' | 'coach') => void
}) {
  const { openHistory } = useTraineeHistory()
  const [open, setOpen] = useState(false)
  const initial = (user.name ?? user.phone).slice(0, 1).toUpperCase()
  const joined = new Date(user.created_at).toLocaleDateString('he-IL')

  return (
    <div className="card cursor-pointer" onClick={() => setOpen(v => !v)}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-600 flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0" onClick={e => { if (user.role === 'trainee') { e.stopPropagation(); openHistory(user) } }}>
          <p className="font-semibold text-slate-800 truncate cursor-pointer">{user.name ?? 'ללא שם'}</p>
          <p className="text-xs text-slate-400 truncate">{user.phone} · הצטרף {joined}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          user.role === 'coach' ? 'bg-amber-100 text-amber-700' : 'bg-primary-50 text-primary-600'
        }`}>
          {user.role === 'coach' ? 'מאמן' : 'מתאמן'}
        </span>
      </div>

      {open && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onRoleChange(user.id, user.role === 'coach' ? 'trainee' : 'coach')}
            className="flex-1 bg-amber-50 text-amber-700 font-semibold py-2 rounded-xl text-sm"
          >
            {user.role === 'coach' ? 'הפוך למתאמן' : 'הפוך למאמן'}
          </button>
          <button
            onClick={() => onDeactivate(user.id, user.name)}
            className="bg-slate-100 text-slate-600 font-semibold py-2 px-4 rounded-xl text-sm"
          >
            הסר
          </button>
        </div>
      )}
    </div>
  )
}

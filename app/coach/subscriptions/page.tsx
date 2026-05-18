'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@/lib/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { useTraineeHistory } from '@/contexts/TraineeHistoryContext'

interface Plan {
  id: string
  name: string
  price: number
  entries_per_month: number
}

interface BillingRow {
  user: User
  attended: number
  matchedPlan: Plan | null
  overQuota: number
  amountPaid: number
}

function matchPlan(attended: number, plans: Plan[]): Plan | null {
  if (!plans.length) return null
  const sorted = [...plans].sort((a, b) => a.entries_per_month - b.entries_per_month)
  return sorted.find(p => p.entries_per_month >= attended) ?? sorted[sorted.length - 1]
}

function paymentStatus(owed: number, paid: number): 'full' | 'partial' | 'none' {
  if (paid <= 0) return 'none'
  if (paid >= owed) return 'full'
  return 'partial'
}

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

export default function SubscriptionsPage() {
  const { openHistory } = useTraineeHistory()
  const [plans, setPlans] = useState<Plan[]>([])
  const [trainees, setTrainees] = useState<User[]>([])
  const [tab, setTab] = useState<'plans' | 'billing'>('plans')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [billing, setBilling] = useState<BillingRow[]>([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sentMsg, setSentMsg] = useState('')

  const [payingId, setPayingId] = useState<string | null>(null)
  const [payInput, setPayInput] = useState('')
  const [savingPay, setSavingPay] = useState(false)

  // Plan form
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [planName, setPlanName] = useState('')
  const [planPrice, setPlanPrice] = useState('')
  const [planEntries, setPlanEntries] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const [{ data: p }, { data: u }] = await Promise.all([
      supabase.from('subscription_plans').select('*').order('entries_per_month'),
      supabase.from('users').select('*').eq('role', 'trainee').eq('is_active', true).order('name'),
    ])
    setPlans(p ?? [])
    setTrainees(u ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const savePlan = async () => {
    if (!planName.trim() || !planPrice || !planEntries) return
    setSaving(true)
    const payload = { name: planName.trim(), price: Number(planPrice), entries_per_month: Number(planEntries) }
    if (editPlan) {
      await supabase.from('subscription_plans').update(payload).eq('id', editPlan.id)
    } else {
      await supabase.from('subscription_plans').insert(payload)
    }
    setPlanName(''); setPlanPrice(''); setPlanEntries('')
    setShowPlanForm(false); setEditPlan(null)
    setSaving(false)
    await load()
  }

  const deletePlan = async (id: string) => {
    if (!confirm('למחוק את המנוי?')) return
    await supabase.from('subscription_plans').delete().eq('id', id)
    await load()
  }

  const openEdit = (plan: Plan) => {
    setEditPlan(plan); setPlanName(plan.name)
    setPlanPrice(String(plan.price)); setPlanEntries(String(plan.entries_per_month))
    setShowPlanForm(true)
  }

  const loadBilling = async () => {
    setBillingLoading(true)
    const monthStart = startOfMonth(new Date(year, month - 1))
    const monthEnd = endOfMonth(monthStart)
    const startStr = format(monthStart, 'yyyy-MM-dd')
    const endStr = format(monthEnd, 'yyyy-MM-dd')

    const attendedMap: Record<string, number> = {}
    const { data: regs } = await supabase
      .from('registrations').select('*')
      .gte('occurrence_date', startStr).lte('occurrence_date', endStr).eq('attended', true)
    regs?.forEach(r => { attendedMap[r.user_id] = (attendedMap[r.user_id] ?? 0) + 1 })

    const { data: payments } = await supabase
      .from('billing_payments').select('user_id, amount_paid')
      .eq('year', year).eq('month', month)
    const payMap: Record<string, number> = {}
    payments?.forEach((p: any) => { payMap[p.user_id] = Number(p.amount_paid) })

    const rows: BillingRow[] = trainees.map(t => {
      const attended = attendedMap[t.id] ?? 0
      const matched = matchPlan(attended, plans)
      const overQuota = matched ? Math.max(0, attended - matched.entries_per_month) : 0
      return { user: t, attended, matchedPlan: attended > 0 ? matched : null, overQuota, amountPaid: payMap[t.id] ?? 0 }
    }).sort((a, b) => {
      const aR = a.matchedPlan ? a.matchedPlan.price - a.amountPaid : 0
      const bR = b.matchedPlan ? b.matchedPlan.price - b.amountPaid : 0
      return bR - aR
    })

    setBilling(rows)
    setBillingLoading(false)
  }

  useEffect(() => { if (tab === 'billing') loadBilling() }, [tab, year, month, trainees, plans])

  const savePayment = async (userId: string, owed: number) => {
    const amount = Math.min(Number(payInput) || 0, owed)
    if (amount < 0) return
    setSavingPay(true)
    await supabase.from('billing_payments').upsert(
      { user_id: userId, year, month, amount_paid: amount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,year,month' }
    )
    setBilling(prev => prev.map(r =>
      r.user.id === userId ? { ...r, amountPaid: amount } : r
    ).sort((a, b) => {
      const aR = a.matchedPlan ? a.matchedPlan.price - a.amountPaid : 0
      const bR = b.matchedPlan ? b.matchedPlan.price - b.amountPaid : 0
      return bR - aR
    }))
    setPayingId(null); setPayInput(''); setSavingPay(false)
  }

  const sendNotifications = async () => {
    const toNotify = billing.filter(r => r.attended > 0 && r.matchedPlan)
    if (!toNotify.length) return
    setSending(true); setSentMsg('')
    for (const row of toNotify) {
      const remaining = row.matchedPlan!.price - row.amountPaid
      const body = remaining <= 0
        ? `שולם במלואו ✓ — ${row.matchedPlan!.name}`
        : `נותר לתשלום ₪${remaining} — ${row.matchedPlan!.name} (${row.attended} כניסות)`
      await fetch('/api/send-notification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [row.user.id], title: `סיכום חודש ${MONTHS[month - 1]} 💳`, body }),
      })
    }
    setSentMsg(`נשלחו הודעות ל-${toNotify.length} מתאמנים`)
    setSending(false)
    setTimeout(() => setSentMsg(''), 4000)
  }

  const totalOwed = billing.reduce((s, r) => s + (r.matchedPlan?.price ?? 0), 0)
  const totalPaid = billing.reduce((s, r) => s + r.amountPaid, 0)
  const totalRemaining = totalOwed - totalPaid

  return (
    <main>
      <header className="bg-primary-600 text-white px-5 pt-12 pb-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold">מנויים וחיוב</h1>
          <p className="text-primary-200 text-sm mt-1">{plans.length} סוגי מנוי · {trainees.length} מתאמנים</p>
        </div>
        <div className="flex mt-4 max-w-2xl mx-auto rounded-2xl overflow-hidden border border-primary-400">
          {(['plans', 'billing'] as const).map((t, i) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${tab === t ? 'bg-white text-primary-600' : 'text-primary-200'}`}>
              {['סוגי מנוי', 'חיוב חודשי'][i]}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 py-5 max-w-2xl mx-auto space-y-4">

        {/* ── TAB: Plans ── */}
        {tab === 'plans' && (
          <>
            {!showPlanForm && (
              <button onClick={() => { setEditPlan(null); setPlanName(''); setPlanPrice(''); setPlanEntries(''); setShowPlanForm(true) }}
                className="btn-ghost text-base py-3">➕ הוסף סוג מנוי</button>
            )}
            {showPlanForm && (
              <div className="card space-y-3">
                <h2 className="font-bold text-slate-800">{editPlan ? 'עריכת מנוי' : 'מנוי חדש'}</h2>
                <input type="text" placeholder="שם המנוי (לדוג׳: מנוי 8 כניסות)" value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-400" />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">מחיר (₪)</label>
                    <input type="number" placeholder="350" value={planPrice}
                      onChange={e => setPlanPrice(e.target.value)}
                      className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-400" dir="ltr" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 mb-1 block">כניסות בחודש</label>
                    <input type="number" placeholder="8" value={planEntries}
                      onChange={e => setPlanEntries(e.target.value)}
                      className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-primary-400" dir="ltr" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={savePlan} disabled={saving} className="flex-1 btn-primary py-3 text-base">{saving ? 'שומר...' : 'שמור'}</button>
                  <button onClick={() => setShowPlanForm(false)} className="flex-1 btn-ghost py-3 text-base">ביטול</button>
                </div>
              </div>
            )}
            {plans.length === 0 && !showPlanForm && (
              <div className="card text-center py-10 text-slate-400">
                <p className="text-4xl mb-2">💳</p><p>אין סוגי מנוי עדיין</p>
              </div>
            )}
            <div className="space-y-2">
              {plans.map(plan => (
                <div key={plan.id} className="card flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{plan.name}</p>
                    <p className="text-sm text-slate-500">{plan.entries_per_month} כניסות · ₪{plan.price}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(plan)} className="text-sm bg-primary-50 text-primary-600 px-3 py-1.5 rounded-xl font-medium">עריכה</button>
                    <button onClick={() => deletePlan(plan.id)} className="text-sm bg-red-50 text-danger px-3 py-1.5 rounded-xl font-medium">מחק</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── TAB: Billing ── */}
        {tab === 'billing' && (
          <>
            <div className="flex items-center gap-3">
              <button onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}
                className="w-10 h-10 rounded-full bg-slate-200 text-xl flex items-center justify-center">›</button>
              <p className="flex-1 text-center font-bold text-slate-800">{MONTHS[month - 1]} {year}</p>
              <button onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}
                className="w-10 h-10 rounded-full bg-slate-200 text-xl flex items-center justify-center">‹</button>
            </div>

            {billingLoading ? (
              <div className="text-center py-10 text-slate-400">
                <p className="text-3xl animate-bounce">💳</p><p className="mt-2">מחשב...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="card text-center py-3 px-1">
                    <p className="text-lg font-bold text-slate-800">₪{totalOwed.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">לגבות</p>
                  </div>
                  <div className="card text-center py-3 px-1">
                    <p className="text-lg font-bold text-green-600">₪{totalPaid.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">שולם</p>
                  </div>
                  <div className="card text-center py-3 px-1">
                    <p className="text-lg font-bold text-orange-500">₪{totalRemaining.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">נותר</p>
                  </div>
                </div>

                <button onClick={sendNotifications} disabled={sending || billing.filter(r => r.attended > 0).length === 0}
                  className="btn-primary w-full py-3 text-base">
                  {sending ? 'שולח...' : '📲 שלח סיכום חודשי לכל המתאמנים'}
                </button>
                {sentMsg && <p className="text-center text-sm text-green-600 font-medium">{sentMsg} ✓</p>}

                <div className="space-y-2">
                  {billing.map(row => {
                    const owed = row.matchedPlan?.price ?? 0
                    const remaining = owed - row.amountPaid
                    const status = row.matchedPlan ? paymentStatus(owed, row.amountPaid) : 'none'
                    const isPayingThis = payingId === row.user.id

                    return (
                      <div key={row.user.id} className={`card transition-all ${status === 'full' ? 'opacity-60' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-600 flex-shrink-0">
                            {(row.user.name ?? row.user.phone).slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-800 truncate">{row.user.name ?? 'ללא שם'}</p>
                              <button
                                onClick={() => openHistory(row.user)}
                                className="flex-shrink-0 text-xs bg-slate-100 text-slate-600 hover:bg-primary-100 hover:text-primary-700 px-2 py-0.5 rounded-lg font-medium transition-colors"
                              >
                                📋 דוח
                              </button>
                            </div>
                            {row.matchedPlan && (
                              <span className="inline-block mt-0.5 text-xs font-semibold bg-primary-50 text-primary-600 px-2 py-0.5 rounded-lg">
                                {row.matchedPlan.name}
                              </span>
                            )}
                            {!row.matchedPlan && (
                              <p className="text-xs text-slate-400">{row.attended === 0 ? 'לא הגיע החודש' : '—'}</p>
                            )}
                            <p className="text-xs text-slate-400 mt-0.5">{row.attended} כניסות</p>
                          </div>
                          <div className="flex-shrink-0 text-left">
                            {row.matchedPlan ? (
                              <div className="flex flex-col items-end gap-1">
                                <p className="text-base font-bold text-slate-800">₪{owed}</p>
                                {status === 'full' && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg">✓ שולם</span>}
                                {status === 'partial' && <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">נותר ₪{remaining}</span>}
                                {status === 'none' && <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">לא שולם</span>}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400">{row.attended} כניסות</p>
                            )}
                          </div>
                        </div>

                        {row.matchedPlan && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                              <span>{row.attended} מתוך {row.matchedPlan.entries_per_month} כניסות</span>
                              {row.overQuota > 0 && <span className="text-orange-500 font-medium">עבר ב-{row.overQuota}</span>}
                            </div>
                            <div className="bg-slate-100 rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full transition-all ${status === 'full' ? 'bg-green-400' : row.overQuota > 0 ? 'bg-orange-400' : 'bg-primary-500'}`}
                                style={{ width: `${Math.min(100, row.matchedPlan.entries_per_month > 0 ? (row.attended / row.matchedPlan.entries_per_month) * 100 : 0)}%` }} />
                            </div>
                          </div>
                        )}

                        {row.matchedPlan && status !== 'full' && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            {isPayingThis ? (
                              <div className="flex gap-2">
                                <input type="number" placeholder={`סכום (עד ₪${remaining})`} value={payInput}
                                  onChange={e => setPayInput(e.target.value)}
                                  className="flex-1 border-2 border-primary-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
                                  dir="ltr" autoFocus />
                                <button onClick={() => savePayment(row.user.id, owed)} disabled={savingPay}
                                  className="bg-primary-600 text-white font-bold px-4 py-2 rounded-xl text-sm">
                                  {savingPay ? '...' : 'שמור'}
                                </button>
                                <button onClick={() => { setPayingId(null); setPayInput('') }}
                                  className="bg-slate-100 text-slate-600 font-bold px-3 py-2 rounded-xl text-sm">✕</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button onClick={() => { setPayingId(row.user.id); setPayInput(String(remaining)) }}
                                  className="flex-1 bg-green-50 text-green-700 font-semibold py-2 rounded-xl text-sm">
                                  + הוסף תשלום
                                </button>
                                {status === 'partial' && <p className="text-xs text-slate-400">שולם כבר ₪{row.amountPaid}</p>}
                              </div>
                            )}
                          </div>
                        )}

                        {row.matchedPlan && status === 'full' && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <button onClick={async () => {
                              setPayInput('0')
                              await savePayment(row.user.id, 0)
                              setBilling(prev => prev.map(r => r.user.id === row.user.id ? { ...r, amountPaid: 0 } : r))
                            }} className="text-xs text-slate-400 underline">בטל תשלום</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

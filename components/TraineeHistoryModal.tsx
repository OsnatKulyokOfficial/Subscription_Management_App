'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { User } from '@/lib/types'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

interface Plan {
  id: string
  name: string
  price: number
  entries_per_month: number
}

interface HistoryRow {
  year: number
  month: number
  attended: number
  matchedPlan: Plan | null
  amountPaid: number
}

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

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

interface Props {
  user: User | null
  onClose: () => void
}

export default function TraineeHistoryModal({ user, onClose }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setRows([])

    const load = async () => {
      const { data: plans } = await supabase.from('subscription_plans').select('*').order('entries_per_month')
      const allPlans: Plan[] = plans ?? []

      const now = new Date()
      const months = Array.from({ length: 12 }, (_, i) => {
        const d = subMonths(now, i)
        return { year: d.getFullYear(), month: d.getMonth() + 1 }
      })

      const { data: payments } = await supabase
        .from('billing_payments').select('year, month, amount_paid').eq('user_id', user.id)
      const payMap: Record<string, number> = {}
      payments?.forEach((p: any) => { payMap[`${p.year}-${p.month}`] = Number(p.amount_paid) })

      const result: HistoryRow[] = await Promise.all(months.map(async ({ year: y, month: m }) => {
        const ms = startOfMonth(new Date(y, m - 1))
        const me = endOfMonth(ms)
        const { data: regs } = await supabase
          .from('registrations').select('id')
          .eq('user_id', user.id)
          .gte('occurrence_date', format(ms, 'yyyy-MM-dd'))
          .lte('occurrence_date', format(me, 'yyyy-MM-dd'))
          .eq('attended', true)
        const attended = regs?.length ?? 0
        const matched = attended > 0 ? matchPlan(attended, allPlans) : null
        return { year: y, month: m, attended, matchedPlan: matched, amountPaid: payMap[`${y}-${m}`] ?? 0 }
      }))

      setRows(result)
      setLoading(false)
    }

    load()
  }, [user?.id])

  if (!user) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{user.name ?? 'ללא שם'}</h2>
              <p className="text-sm text-slate-400">היסטוריית מנויים ותשלומים</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-lg">✕</button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-3xl animate-bounce">💳</p>
            <p className="mt-2">טוען...</p>
          </div>
        ) : (
          <div className="px-4 py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="text-right py-2 font-semibold">חודש</th>
                  <th className="text-center py-2 font-semibold">כניסות</th>
                  <th className="text-right py-2 font-semibold">מנוי</th>
                  <th className="text-center py-2 font-semibold">חוב</th>
                  <th className="text-center py-2 font-semibold">שולם</th>
                  <th className="text-center py-2 font-semibold">סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const owed = row.matchedPlan?.price ?? 0
                  const remaining = owed - row.amountPaid
                  const status = row.matchedPlan ? paymentStatus(owed, row.amountPaid) : null

                  return (
                    <tr key={`${row.year}-${row.month}`} className="border-b border-slate-50">
                      <td className="py-3 font-medium text-slate-700 whitespace-nowrap">
                        {row.month}/{String(row.year).slice(2)}
                        <span className="text-xs text-slate-400 block">{MONTHS[row.month - 1]}</span>
                      </td>
                      <td className="py-3 text-center text-slate-600">{row.attended > 0 ? row.attended : '—'}</td>
                      <td className="py-3 text-xs text-slate-600">{row.matchedPlan?.name ?? '—'}</td>
                      <td className="py-3 text-center font-semibold text-slate-800">{owed > 0 ? `₪${owed}` : '—'}</td>
                      <td className="py-3 text-center text-green-600 font-medium">{row.amountPaid > 0 ? `₪${row.amountPaid}` : '—'}</td>
                      <td className="py-3 text-center">
                        {status === 'full' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">שולם ✓</span>}
                        {status === 'partial' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">נותר ₪{remaining}</span>}
                        {status === 'none' && owed > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">חייב</span>}
                        {!status && <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

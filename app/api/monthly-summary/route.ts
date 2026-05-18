import { NextRequest, NextResponse } from 'next/server'
import admin from '@/lib/firebase-admin'
import { createClient } from '@supabase/supabase-js'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function matchPlan(attended: number, plans: any[]): any | null {
  if (!plans.length) return null
  const sorted = [...plans].sort((a, b) => a.entries_per_month - b.entries_per_month)
  return sorted.find(p => p.entries_per_month >= attended) ?? sorted[sorted.length - 1]
}

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron (or manually with secret)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Calculate for the previous month
  const prevMonth = subMonths(new Date(), 1)
  const year = prevMonth.getFullYear()
  const month = prevMonth.getMonth() + 1
  const monthStart = startOfMonth(prevMonth)
  const monthEnd = endOfMonth(prevMonth)
  const startStr = format(monthStart, 'yyyy-MM-dd')
  const endStr = format(monthEnd, 'yyyy-MM-dd')

  // Load plans and active trainees
  const [{ data: plans }, { data: trainees }] = await Promise.all([
    supabase.from('subscription_plans').select('*').order('entries_per_month'),
    supabase.from('users').select('*').eq('role', 'trainee').eq('is_active', true),
  ])

  if (!trainees?.length || !plans?.length) {
    return NextResponse.json({ sent: 0, reason: 'no trainees or plans' })
  }

  // Count attendance per trainee
  const { data: regs } = await supabase
    .from('registrations').select('user_id')
    .gte('occurrence_date', startStr)
    .lte('occurrence_date', endStr)
    .eq('attended', true)

  const attendedMap: Record<string, number> = {}
  regs?.forEach((r: any) => { attendedMap[r.user_id] = (attendedMap[r.user_id] ?? 0) + 1 })

  // Get FCM tokens for all trainees
  const traineeIds = trainees.map((t: any) => t.id)
  const { data: allTokens } = await supabase
    .from('fcm_tokens').select('user_id, token').in('user_id', traineeIds)

  const tokenMap: Record<string, string[]> = {}
  allTokens?.forEach((t: any) => {
    if (!tokenMap[t.user_id]) tokenMap[t.user_id] = []
    tokenMap[t.user_id].push(t.token)
  })

  const monthName = MONTHS[month - 1]
  let sent = 0

  for (const trainee of trainees) {
    const attended = attendedMap[trainee.id] ?? 0
    if (attended === 0) continue

    const plan = matchPlan(attended, plans)
    if (!plan) continue

    const tokens = tokenMap[trainee.id]
    if (!tokens?.length) continue

    const body = `הגעת ${attended} פעמים — ${plan.name} | ₪${plan.price}`

    try {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: `סיכום חודש ${monthName} 💳`,
          body,
        },
        android: { notification: { channelId: 'training', sound: 'default' } },
        apns: { payload: { aps: { sound: 'default' } } },
      })
      sent++
    } catch (e) {
      console.error(`Failed to notify ${trainee.name}:`, e)
    }
  }

  return NextResponse.json({ sent, month: `${monthName} ${year}` })
}

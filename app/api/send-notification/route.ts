import { NextRequest, NextResponse } from 'next/server'
import admin from '@/lib/firebase-admin'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userIds, title, body } = await req.json()
    if (!userIds?.length || !title) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 })
    }

    const { data: tokens } = await supabase
      .from('fcm_tokens')
      .select('token')
      .in('user_id', userIds)

    if (!tokens?.length) return NextResponse.json({ sent: 0 })

    const response = await admin.messaging().sendEachForMulticast({
      tokens: tokens.map(t => t.token),
      notification: { title, body },
      android: { notification: { channelId: 'training', sound: 'default' } },
      apns: { payload: { aps: { sound: 'default' } } },
    })

    return NextResponse.json({ sent: response.successCount })
  } catch (err) {
    console.error('send-notification error:', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

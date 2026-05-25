import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TEAM_CODE = process.env.NEXT_PUBLIC_TEAM_CODE!.trim()
const COACH_ID = process.env.COACH_ID!.trim()

export async function POST(req: NextRequest) {
  const { phone, code, name, isCoach } = await req.json()

  if (!phone) {
    return NextResponse.json({ error: 'הכנס מספר טלפון' }, { status: 400 })
  }

  // Returning user — recognized by phone, no code needed
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .single()

  if (existing) {
    // Wants to log in as coach — verify ID first
    if (isCoach && existing.role !== 'coach') {
      if (!code) return NextResponse.json({ needsCode: true })
      if (code !== COACH_ID) {
        return NextResponse.json({ error: 'תעודת זהות שגויה' }, { status: 401 })
      }
      await supabase.from('users').update({ role: 'coach' }).eq('id', existing.id)
      return NextResponse.json({
        userId: existing.id,
        role: 'coach',
        name: existing.name,
        phone: existing.phone,
      })
    }

    // Normal returning user
    if (!existing.name && !name) {
      return NextResponse.json({ needsName: true })
    }
    if (name && !existing.name) {
      await supabase.from('users').update({ name: name.trim() }).eq('id', existing.id)
    }
    return NextResponse.json({
      userId: existing.id,
      role: existing.role,
      name: name?.trim() ?? existing.name,
      phone: existing.phone,
    })
  }

  // New user — need credentials
  if (!code) {
    return NextResponse.json({ needsCode: true })
  }

  // Validate code based on role
  if (isCoach) {
    if (code !== COACH_ID) {
      return NextResponse.json({ error: 'תעודת זהות שגויה' }, { status: 401 })
    }
  } else {
    if (code !== TEAM_CODE) {
      return NextResponse.json({ error: 'קוד קבוצה שגוי' }, { status: 401 })
    }
  }

  // Need name before creating
  if (!name) {
    return NextResponse.json({ needsName: true })
  }

  const role = isCoach ? 'coach' : 'trainee'
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ phone, name: name.trim(), role })
    .select()
    .single()

  if (error || !newUser) {
    console.error('insert error:', JSON.stringify(error))
    return NextResponse.json({ error: 'שגיאה ביצירת משתמש. נסה שוב.' }, { status: 500 })
  }

  return NextResponse.json({
    userId: newUser.id,
    role: newUser.role,
    name: newUser.name,
    phone: newUser.phone,
  })
}

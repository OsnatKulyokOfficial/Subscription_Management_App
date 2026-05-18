'use client'

import { useEffect, useState } from 'react'
import { registerForPushNotifications } from '@/lib/firebase'
import { createClient } from '@/lib/supabase'

export default function NotificationSetup({ userId }: { userId: string }) {
  const [status, setStatus] = useState<'idle' | 'asking' | 'done' | 'denied'>('idle')
  const supabase = createClient()

  useEffect(() => {
    // If already granted, register silently
    if (Notification.permission === 'granted') {
      registerAndSave()
    }
  }, [])

  const registerAndSave = async () => {
    const token = await registerForPushNotifications()
    if (!token) return
    await supabase.from('fcm_tokens').upsert(
      { user_id: userId, token, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    setStatus('done')
  }

  const handleAsk = async () => {
    setStatus('asking')
    const token = await registerForPushNotifications()
    if (token) {
      await supabase.from('fcm_tokens').upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      setStatus('done')
    } else {
      setStatus('denied')
    }
  }

  if (status === 'done' || Notification.permission === 'granted') return null
  if (status === 'denied') return null

  return (
    <div className="mx-4 mt-4 bg-primary-50 border border-primary-200 rounded-2xl p-4 flex items-center gap-3">
      <span className="text-2xl">🔔</span>
      <div className="flex-1">
        <p className="font-semibold text-primary-800 text-sm">קבל התראות על אימונים</p>
        <p className="text-primary-600 text-xs mt-0.5">ביטולים ושינויים ישר לטלפון</p>
      </div>
      <button
        onClick={handleAsk}
        disabled={status === 'asking'}
        className="bg-primary-600 text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform"
      >
        {status === 'asking' ? '...' : 'אפשר'}
      </button>
    </div>
  )
}

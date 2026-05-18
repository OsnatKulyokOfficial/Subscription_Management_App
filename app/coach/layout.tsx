'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getSession, clearSession } from '@/lib/session'
import { TraineeHistoryProvider } from '@/contexts/TraineeHistoryContext'

const NAV = [
  { href: '/coach', icon: '🏠', label: 'ראשי' },
  { href: '/coach/users', icon: '👤', label: 'חברים' },
  { href: '/coach/sessions', icon: '📅', label: 'אימונים' },
  { href: '/coach/attendance', icon: '✅', label: 'נוכחות' },
  { href: '/coach/subscriptions', icon: '💳', label: 'מנויים' },
  { href: '/coach/reports', icon: '📊', label: 'דוחות' },
]

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const session = getSession()
    if (!session || session.role !== 'coach') {
      clearSession()
      router.replace('/')
    }
  }, [])

  return (
    <TraineeHistoryProvider>
    <div className="min-h-dvh flex flex-col pb-32">
      <div className="flex-1">
        {children}
      </div>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-100 shadow-lg z-40">
        <div className="flex max-w-2xl mx-auto">
          {NAV.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                  isActive ? 'text-primary-600' : 'text-slate-400'
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className={`text-[9px] font-medium ${isActive ? 'text-primary-600' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
        <div className="text-center text-[11.38px] text-slate-700 font-medium py-1 leading-none border-t border-slate-100">
          כל הזכויות שמורות לאסנת קוליוק&nbsp;&nbsp;|&nbsp;&nbsp;050-4796796
        </div>
      </nav>
    </div>
    </TraineeHistoryProvider>
  )
}

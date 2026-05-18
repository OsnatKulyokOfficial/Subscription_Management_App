'use client'

import { usePathname } from 'next/navigation'

export default function GlobalFooter() {
  const pathname = usePathname()
  if (pathname.startsWith('/coach')) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-sm border-t border-slate-100 text-center text-[11.38px] text-slate-700 font-medium py-1 leading-none">
      כל הזכויות שמורות לאסנת קוליוק&nbsp;&nbsp;|&nbsp;&nbsp;050-4796796
    </div>
  )
}

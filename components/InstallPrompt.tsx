'use client'

import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isIOSChrome, setIsIOSChrome] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (sessionStorage.getItem('install-dismissed')) return

    const ua = navigator.userAgent
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
    const iosChrome = ios && /CriOS/i.test(ua)
    setIsIOS(ios)
    setIsIOSChrome(iosChrome)

    if (ios) {
      const t = setTimeout(() => setShow(true), 2000)
      return () => clearTimeout(t)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const dismiss = () => {
    sessionStorage.setItem('install-dismissed', '1')
    setShow(false)
    setShowIOSGuide(false)
  }

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') dismiss()
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <>
      {/* Backdrop for iOS guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={dismiss}>
          <div className="bg-white w-full rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold text-slate-800">הוספה למסך הבית</h2>
              <button onClick={dismiss} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">✕</button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-xl flex-shrink-0">1</div>
                <div>
                  <p className="font-semibold text-slate-800">לחצי על כפתור השיתוף</p>
                  <p className="text-sm text-slate-500">הריבוע עם החץ <span className="text-lg">⬆️</span> בתחתית מסך Safari</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-xl flex-shrink-0">2</div>
                <div>
                  <p className="font-semibold text-slate-800">גיללי למטה ובחרי</p>
                  <p className="text-sm text-slate-500">"הוסף למסך הבית" <span className="text-lg">➕</span></p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-xl flex-shrink-0">3</div>
                <div>
                  <p className="font-semibold text-slate-800">לחצי "הוסף"</p>
                  <p className="text-sm text-slate-500">הסמל יופיע על המסך כמו אפליקציה רגילה ✓</p>
                </div>
              </div>
            </div>

            {isIOSChrome && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <p className="text-sm text-blue-800 font-bold mb-2">את/ה ב-Chrome — ככה עושים:</p>
                <div className="space-y-2 text-xs text-blue-700">
                  <p>1. לחצי על שלוש הנקודות <strong>⋮</strong> בתחתית Chrome</p>
                  <p>2. בחרי <strong>"הוסף למסך הבית"</strong></p>
                  <p>3. לחצי <strong>"הוסף"</strong></p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom banner */}
      {!showIOSGuide && (
        <div className="fixed bottom-14 inset-x-0 z-40 px-4">
          <div className="max-w-md mx-auto bg-primary-600 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex-shrink-0 overflow-hidden">
              <img src="/logo.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">הוסף למסך הבית</p>
              <p className="text-primary-200 text-xs">גישה מהירה כמו אפליקציה</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {isIOS ? (
                <button
                  onClick={() => setShowIOSGuide(true)}
                  className="bg-white text-primary-600 font-bold text-xs px-3 py-2 rounded-xl"
                >
                  איך?
                </button>
              ) : (
                <button
                  onClick={handleAndroidInstall}
                  className="bg-white text-primary-600 font-bold text-xs px-3 py-2 rounded-xl"
                >
                  התקן
                </button>
              )}
              <button onClick={dismiss} className="text-primary-300 text-lg px-1">✕</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

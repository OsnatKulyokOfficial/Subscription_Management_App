'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function InstallBanner() {
  const [url, setUrl] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setUrl('https://teamchampions.vercel.app')

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }

  if (installed) return null

  return (
    <div className="card border border-primary-200 bg-primary-50">
      <div className="flex items-center gap-3">
        <img src="/logo.jpg" alt="TeamChampions" className="w-10 h-10 rounded-xl object-cover" />
        <div className="flex-1">
          <p className="font-bold text-primary-800 text-sm">TeamChampions</p>
          <p className="text-xs text-primary-600">שלחו קישור למתאמנים להתקנה</p>
        </div>
        <div className="flex gap-2">
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="bg-primary-600 text-white text-xs font-bold px-3 py-2 rounded-xl"
            >
              התקן
            </button>
          )}
          <button
            onClick={() => setShowQR(v => !v)}
            className="bg-white border border-primary-300 text-primary-600 text-xs font-bold px-3 py-2 rounded-xl"
          >
            {showQR ? 'סגור' : '📲 QR'}
          </button>
        </div>
      </div>

      {showQR && url && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="bg-white p-3 rounded-2xl shadow-sm">
            <QRCodeSVG value={url} size={160} />
          </div>
          <p className="text-xs text-primary-600 font-medium">{url}</p>
          <p className="text-xs text-slate-400 text-center">
            המתאמן מכוון את המצלמה לברקוד, נכנס לאתר,<br />
            לוחץ "הוסף למסך הבית" — וזה מתעדכן אוטומטית
          </p>
        </div>
      )}
    </div>
  )
}

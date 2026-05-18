import type { Metadata, Viewport } from 'next'
import './globals.css'
import dynamic from 'next/dynamic'

const InstallPrompt = dynamic(() => import('@/components/InstallPrompt'), { ssr: false })
const GlobalFooter = dynamic(() => import('@/components/GlobalFooter'), { ssr: false })

export const metadata: Metadata = {
  title: 'TeamChampions',
  description: 'ניהול אימונים - TeamChampions',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
    shortcut: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TeamChampions',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#4f46e5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head />
      <body>
        {children}
        <InstallPrompt />
        <GlobalFooter />
      </body>
    </html>
  )
}

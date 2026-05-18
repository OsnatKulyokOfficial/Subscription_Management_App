export async function sendPush(userIds: string[], title: string, body: string) {
  if (!userIds.length) return
  try {
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, title, body }),
    })
  } catch {
    // Notifications are best-effort — don't break the UI
  }
}

import admin from 'firebase-admin'

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? '{}')
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
  } catch {
    // Firebase Admin not configured yet
  }
}

export default admin

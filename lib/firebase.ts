// Firebase configuration for FCM (Firebase Cloud Messaging)

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, type Messaging } from 'firebase/messaging'

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCwPuwVhBNQelLVbv6AGz65rkrDFklBz5I',
  authDomain: 'medxvzla.firebaseapp.com',
  projectId: 'medxvzla',
  storageBucket: 'medxvzla.firebasestorage.app',
  messagingSenderId: '245576964797',
  appId: '1:245576964797:web:0fb1f4c5d383e62fc075d4',
  measurementId: 'G-DZ3T0VYP8C'
}

// VAPID key for FCM Web Push
export const VAPID_KEY =
  'BMZqVy4d18u4a0pkB0xhHeA1qUUBDhq-htLNKS_MYPfiQ-kTpasAJFmoDnN1EQooMXvfsxreOGS9D4OHp51li24'

// Initialize Firebase (singleton pattern)
let app: FirebaseApp | null = null
let messaging: Messaging | null = null

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig)
    } else {
      app = getApps()[0]
    }
  }
  return app
}

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null
  if (!messaging) {
    const firebaseApp = getFirebaseApp()
    messaging = getMessaging(firebaseApp)
  }
  return messaging
}

export async function getFCMToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const messaging = getFirebaseMessaging()
  if (!messaging) return null
  try {
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    return token
  } catch (err) {
    console.error('Error getting FCM token:', err)
    return null
  }
}

export { firebaseConfig }

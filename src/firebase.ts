import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDvKggYRSYNd3bya083P1WDNPSTTGgClqo',
  authDomain: 'imagenologiasigloxxi.firebaseapp.com',
  projectId: 'imagenologiasigloxxi',
  storageBucket: 'imagenologiasigloxxi.firebasestorage.app',
  messagingSenderId: '387189577794',
  appId: '1:387189577794:web:be9a34dcdc3c5a5834f5db',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const db = getFirestore(firebaseApp)

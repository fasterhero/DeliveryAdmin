
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDe3snCowaGEr8OvDP3DVfW9gvoFVvkPlk',
  authDomain: 'deliverymarketplace-57851.firebaseapp.com',
  projectId: 'deliverymarketplace-57851',
  storageBucket: 'deliverymarketplace-57851.firebasestorage.app',
  messagingSenderId: '643387902290',
  appId: '1:643387902290:web:933ee548b7693823ef928b',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

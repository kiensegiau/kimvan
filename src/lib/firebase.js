import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseClientConfig } from '@/config/env-config';

// Khởi tạo Firebase App nếu chưa có
const app = !getApps().length ? initializeApp(firebaseClientConfig) : getApp();

// Khởi tạo các dịch vụ Firebase
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage }; 
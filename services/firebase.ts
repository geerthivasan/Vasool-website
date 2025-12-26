
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// PASTE YOUR CONFIG OBJECT HERE
// You can copy this directly from Firebase Console -> Project Settings -> General -> Your Apps
const firebaseConfig = {
  // Example format below - replace with your actual values from the console
  apiKey: "AIzaSy...", 
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Collection References Constants
export const COLLECTIONS = {
  USERS: 'users',
  INVOICES: 'invoices',
  CUSTOMERS: 'customers',
  LOGS: 'activity_logs'
};

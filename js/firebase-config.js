// js/firebase-config.js
// Modular Firebase configuration exporting app, analytics, auth, db (Firestore), and storage.

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCMmYP4jQb4DWvMKygVpqeXgUYx8rhMqts",
  authDomain: "mombasamall.firebaseapp.com",
  projectId: "mombasamall",
  storageBucket: "mombasamall.firebasestorage.app",
  messagingSenderId: "866504824337",
  appId: "1:866504824337:web:047d23085eeee5019f83b0",
  measurementId: "G-BFHGBTPGWE"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (err) {
  // Analytics can fail in non-browser, file://, or blocked environments
  console.warn('Firebase analytics not initialized:', err.message);
}

// Expose globally for vanilla scripts
if (typeof window !== 'undefined') {
  window.__FIREBASE_APP__ = app;
  window.__FIREBASE_CONFIG__ = firebaseConfig;
  window.__FIREBASE_AUTH__ = auth;
  window.__FIREBASE_DB__ = db;
  window.__FIREBASE_STORAGE__ = storage;
}

export { app, analytics, auth, db, storage, firebaseConfig };

// firebase-config.js
// This module initializes Firebase using the web SDK and exports the app and analytics instances.

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyCMmYP4jQb4DWvMKygVpqeXgUYx8rhMqts",
  authDomain: "mombasamall.firebaseapp.com",
  projectId: "mombasamall",
  storageBucket: "mombasamall.firebasestorage.app",
  messagingSenderId: "866504824337",
  appId: "1:866504824337:web:047d23085eeee5019f83b0",
  measurementId: "G-BFHGBTPGWE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Analytics requires the site be served over https (or localhost) and optionally a valid measurementId
let analytics;
try {
  analytics = getAnalytics(app);
} catch (err) {
  // Analytics initialization can fail in non-browser or blocked environments; swallow the error so the rest of the site still works.
  console.warn('Firebase analytics not initialized:', err.message);
}

export { app, analytics, firebaseConfig };

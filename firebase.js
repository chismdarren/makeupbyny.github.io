// This file initializes Firebase and exports the Firebase app instance
// It's loaded before other Firebase modules to ensure proper initialization

// Import Firebase core functionality
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeCYpS1JV5gJWD8qWsnVKenwgbDrIt_h8",
  authDomain: "makeupbyny-1.firebaseapp.com",
  projectId: "makeupbyny-1",
  storageBucket: "makeupbyny-1.appspot.com",
  messagingSenderId: "327675302548",
  appId: "1:327675302548:web:581f25c2c6aebaab629a81",
  measurementId: "G-P8F85KTSFP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Configure Firestore settings properly
try {
  // The correct way to apply Firestore settings
  const settings = {
    ignoreUndefinedProperties: true
  };
  db._setSettings(settings);
  console.log("Firebase settings applied successfully");
} catch (error) {
  console.warn("Could not apply Firestore settings:", error);
}

console.log("✅ Firebase core initialized successfully!");

// Export the initialized services
export { app, db, auth, storage }; 
// Import Firebase SDK modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your web app's Firebase configuration
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
const auth = getAuth(app);
const db = getFirestore(app);

// Define super admin UIDs - initially just the original admin
export const superAdminUIDs = ["yuoaYY14sINHaqtNK5EAz4nl8cc2"];

console.log("✅ Firebase Initialized Successfully!");

// Wait for the DOM to fully load before attaching event listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("📢 DOM Loaded. Setting up event listeners...");

  const signUpForm = document.getElementById('signUpForm');
  if (signUpForm) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    signUpForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const email = emailInput.value;
      const password = passwordInput.value;

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await createUserDocument(user);
        alert("✅ Account created successfully!");
        window.location.href = 'login.html';

      } catch (error) {
        console.error("❌ Error creating user:", error.message);
        alert("Error: " + error.message);
      }
    });
  }
});

// Check if user is a super admin
export async function isSuperAdmin(uid) {
  // First check the hardcoded list (for backward compatibility)
  if (superAdminUIDs.includes(uid)) {
    return true;
  }
  
  // Then check if they have the isSuperAdmin flag in Firestore
  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    return userDoc.exists() && userDoc.data().isSuperAdmin === true;
  } catch (error) {
    console.error("Error checking super admin status:", error);
    return false;
  }
}

// Check if user has admin privileges (either super admin or regular admin)
export async function isAdminUser(uid) {
  // First check if user is a super admin
  if (await isSuperAdmin(uid)) {
    return true;
  }
  
  // If not a super admin, check if they're a regular admin in Firestore
  try {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    return userDoc.exists() && userDoc.data().isAdmin === true;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Function to create user document in Firestore
export async function createUserDocument(user, additionalData = {}) {
  try {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    // Check if user is a super admin (await the result)
    const isUserSuperAdmin = await isSuperAdmin(user.uid);
    
    if (!userDoc.exists()) {
      // Create new user document
      console.log("Creating new user document with data:", additionalData);
      
      await setDoc(userRef, {
        email: user.email,
        firstName: additionalData.firstName || '',
        lastName: additionalData.lastName || '',
        username: additionalData.username || '',
        phoneNumber: additionalData.phoneNumber || '',
        termsAccepted: additionalData.termsAccepted || false,
        termsAcceptedDate: additionalData.termsAcceptedDate || null,
        createdAt: serverTimestamp(),
        isAdmin: isUserSuperAdmin, // Set as admin if they're a super admin
        isSuperAdmin: isUserSuperAdmin // New field to track super admin status
      });
      console.log("✅ User document created for:", user.email);
    } else {
      // Document exists - only update missing fields without overwriting existing data
      const userData = userDoc.data();
      const updates = {};
      
      // Only update fields that are provided in additionalData and don't exist in userData
      if (additionalData.firstName && !userData.firstName) updates.firstName = additionalData.firstName;
      if (additionalData.lastName && !userData.lastName) updates.lastName = additionalData.lastName;
      if (additionalData.username && !userData.username) updates.username = additionalData.username;
      if (additionalData.phoneNumber && !userData.phoneNumber) updates.phoneNumber = additionalData.phoneNumber;
      if (additionalData.termsAccepted && !userData.termsAccepted) {
        updates.termsAccepted = additionalData.termsAccepted;
        updates.termsAcceptedDate = additionalData.termsAcceptedDate || new Date().toISOString();
      }
      
      // Only update if there are fields to update
      if (Object.keys(updates).length > 0) {
        console.log("Updating existing user document with new data:", updates);
        await updateDoc(userRef, updates);
        console.log("✅ User document updated for:", user.email);
      }
    }
  } catch (error) {
    console.error("❌ Error creating/updating user document:", error.message);
  }
}

// Listen for auth state changes to create user documents
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("📢 User detected:", user.email);
    
    try {
      // Check if user document already exists
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // User doesn't have a document yet, create it with default values
        console.log("No existing document found for user, creating one");
        await createUserDocument(user, {
          // Default values
          firstName: '',
          lastName: '',
          username: user.email ? user.email.split('@')[0] : '',
          phoneNumber: '',
          termsAccepted: false
        });
      } else {
        console.log("User document already exists for:", user.email);
      }
    } catch (error) {
      console.error("Error handling auth state change:", error);
    }
  } else {
    console.log("📢 No user signed in.");
  }
});

// Export Firebase instances and config for use in other modules
export { app, auth, db, firebaseConfig };

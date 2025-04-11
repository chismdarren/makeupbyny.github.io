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
    if (!user || !user.uid) {
      console.error("❌ Invalid user object:", user);
      throw new Error("Invalid user object - missing UID");
    }
    
    // Validate required data
    console.log("Creating/updating user document for:", user.email, "with data:", additionalData);
    
    const userRef = doc(db, "users", user.uid);
    
    // First check if user document already exists
    const userDoc = await getDoc(userRef);
    
    // Check if user is a super admin (await the result)
    const isUserSuperAdmin = await isSuperAdmin(user.uid);
    
    // Ensure all needed fields are present in a consistent format
    const userData = {
      email: user.email,
      firstName: additionalData.firstName || '',
      lastName: additionalData.lastName || '',
      username: additionalData.username || '',
      phoneNumber: additionalData.phoneNumber || '',
      termsAccepted: additionalData.termsAccepted || false,
      termsAcceptedDate: additionalData.termsAcceptedDate || null,
      createdAt: serverTimestamp(),
      isAdmin: isUserSuperAdmin, // Set as admin if they're a super admin
      isSuperAdmin: isUserSuperAdmin // Super admin status
    };
    
    if (!userDoc.exists()) {
      // Document doesn't exist - create new user document
      console.log("Creating new user document with data:", userData);
      
      try {
        // Use setDoc with merge option to ensure all fields are written
        await setDoc(userRef, userData);
        console.log("✅ First attempt: User document created for:", user.email);
        
        // Double attempt to ensure data is written
        // This helps overcome Firestore write/read inconsistency issues
        if (additionalData.firstName || additionalData.lastName || additionalData.username || additionalData.phoneNumber) {
          console.log("Making a second update to ensure profile data is saved...");
          const profileData = {
            firstName: additionalData.firstName || '',
            lastName: additionalData.lastName || '',
            username: additionalData.username || '',
            phoneNumber: additionalData.phoneNumber || ''
          };
          
          await updateDoc(userRef, profileData);
          console.log("✅ Second attempt: User profile data updated for:", user.email);
        }
      } catch (writeError) {
        console.error("Error writing user document:", writeError);
        // Try again with just the critical fields
        const criticalData = {
          email: user.email,
          createdAt: serverTimestamp()
        };
        await setDoc(userRef, criticalData);
        console.log("✅ Fallback: Created minimal user document after error");
      }
    } else {
      // Document exists - carefully update without overwriting existing data
      const existingData = userDoc.data();
      console.log("Found existing user document:", existingData);
      
      // Create updates object with only missing or new data
      const updates = {};
      
      // Check each field - prioritize new data from additionalData over empty existing fields
      if (additionalData.firstName && (!existingData.firstName || existingData.firstName === '')) {
        updates.firstName = additionalData.firstName;
      }
      
      if (additionalData.lastName && (!existingData.lastName || existingData.lastName === '')) {
        updates.lastName = additionalData.lastName;
      }
      
      if (additionalData.username && (!existingData.username || existingData.username === '')) {
        updates.username = additionalData.username;
      }
      
      if (additionalData.phoneNumber && (!existingData.phoneNumber || existingData.phoneNumber === '')) {
        updates.phoneNumber = additionalData.phoneNumber;
      }
      
      if (additionalData.termsAccepted && !existingData.termsAccepted) {
        updates.termsAccepted = additionalData.termsAccepted;
        updates.termsAcceptedDate = additionalData.termsAcceptedDate || new Date().toISOString();
      }
      
      // Always ensure email is current
      if (user.email && (!existingData.email || existingData.email !== user.email)) {
        updates.email = user.email;
      }
      
      // Update admin status if needed
      if (isUserSuperAdmin !== existingData.isSuperAdmin) {
        updates.isSuperAdmin = isUserSuperAdmin;
        updates.isAdmin = isUserSuperAdmin || existingData.isAdmin;
      }
      
      // Apply updates if there are any
      if (Object.keys(updates).length > 0) {
        console.log("Updating existing user document with data:", updates);
        await updateDoc(userRef, updates);
        console.log("✅ User document updated for:", user.email);
      } else {
        console.log("No updates needed for existing user document");
      }
    }
    
    // Return a success status
    return { success: true, userId: user.uid };
  } catch (error) {
    console.error("❌ Error creating/updating user document:", error);
    throw error; // Re-throw so calling code can handle it
  }
}

// Listen for auth state changes to create user documents
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("📢 Auth state change - User detected:", user.email);
    
    try {
      // Check if user document already exists
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // User doesn't have a document yet, create a minimal one
        // This is a fallback only - the signup process should have created a complete document
        console.log("Auth state change - No existing document found for user, creating a minimal one");
        
        // Only create minimal placeholder data - don't attempt to guess fields that should come from signup
        await setDoc(userRef, {
          email: user.email,
          createdAt: serverTimestamp(),
          // Don't set empty strings for fields that should be populated during signup
          // This helps identify users that were created outside the normal signup flow
        });
        
        console.log("Auth state change - Created minimal user document");
      } else {
        // Document exists, don't modify it
        console.log("Auth state change - User document already exists for:", user.email);
      }
    } catch (error) {
      console.error("Error handling auth state change:", error);
    }
  } else {
    console.log("📢 Auth state change - No user signed in");
  }
});

// Export Firebase instances and config for use in other modules
export { app, auth, db, firebaseConfig };

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
    
    // Add a small delay to ensure Firebase Auth token is fully processed
    // This helps prevent "Missing or insufficient permissions" errors
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const userRef = doc(db, "users", user.uid);
    
    // First check if user document already exists
    const userDoc = await getDoc(userRef).catch(error => {
      console.warn("Error checking if user document exists:", error.message);
      return { exists: () => false }; // Return a mock doc that doesn't exist
    });
    
    // Check if user is a super admin (await the result)
    const isUserSuperAdmin = await isSuperAdmin(user.uid).catch(() => false);
    
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
    
    // Save all registration data, whether creating or updating
    // Check if we have all the required signup fields in additionalData
    const hasAllRequiredFields = additionalData.firstName && 
                               additionalData.lastName && 
                               additionalData.username && 
                               additionalData.phoneNumber;
    
    if (!userDoc.exists()) {
      // Document doesn't exist - create new user document
      console.log("Creating new user document with data:", userData);
      
      try {
        // Always use merge to make sure we don't overwrite existing data
        await setDoc(userRef, userData, { merge: true });
        console.log("✅ First attempt: User document created for:", user.email);
        
        // If we have complete registration data, make a second attempt to ensure it's saved
        if (hasAllRequiredFields) {
          // Add a small delay before second attempt
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log("Making a second update to ensure complete profile data is saved...");
          const completeProfileData = {
            firstName: additionalData.firstName,
            lastName: additionalData.lastName,
            username: additionalData.username,
            phoneNumber: additionalData.phoneNumber,
            termsAccepted: additionalData.termsAccepted || false,
            termsAcceptedDate: additionalData.termsAcceptedDate || null
          };
          
          await updateDoc(userRef, completeProfileData);
          console.log("✅ Second attempt: Complete user profile data updated for:", user.email);
        }
      } catch (writeError) {
        console.error("Error writing user document:", writeError);
        
        if (writeError.message.includes("Missing or insufficient permissions")) {
          console.warn("Permission error detected. This usually happens if the Firestore security rules don't allow the operation.");
          console.warn("Please update your Firestore security rules to allow this operation.");
          
          // Save data to localStorage for recovery during next login
          if (hasAllRequiredFields) {
            console.log("Saving user data to localStorage for recovery during next login");
            localStorage.setItem(`pendingUserData_${user.uid}`, JSON.stringify({
              firstName: additionalData.firstName,
              lastName: additionalData.lastName,
              username: additionalData.username,
              phoneNumber: additionalData.phoneNumber,
              termsAccepted: additionalData.termsAccepted || false,
              termsAcceptedDate: additionalData.termsAcceptedDate || null
            }));
          }
          
          throw writeError; // Rethrow so it can be handled by the caller's retry mechanism
        }
        
        // Try again with just the critical fields
        try {
          // Add a small delay before fallback attempt
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const criticalData = {
            email: user.email,
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, criticalData);
          console.log("✅ Fallback: Created minimal user document after error");
          
          // Save complete data to localStorage for recovery during next login
          if (hasAllRequiredFields) {
            console.log("Saving complete user data to localStorage for recovery during next login");
            localStorage.setItem(`pendingUserData_${user.uid}`, JSON.stringify({
              firstName: additionalData.firstName,
              lastName: additionalData.lastName,
              username: additionalData.username,
              phoneNumber: additionalData.phoneNumber,
              termsAccepted: additionalData.termsAccepted || false,
              termsAcceptedDate: additionalData.termsAcceptedDate || null
            }));
          }
        } catch (fallbackError) {
          console.error("Fallback creation also failed:", fallbackError);
          throw fallbackError;
        }
      }
    } else {
      // Document exists - update with all required fields from additionalData
      const existingData = userDoc.data();
      console.log("Found existing user document:", existingData);
      
      // Create updates object - ensure all required fields are present
      const updates = {};
      
      // For sign-up data, we want to populate all fields even if they exist but are empty
      if (hasAllRequiredFields) {
        // This is likely a sign-up operation, so ensure all fields are updated
        if (additionalData.firstName) updates.firstName = additionalData.firstName;
        if (additionalData.lastName) updates.lastName = additionalData.lastName;
        if (additionalData.username) updates.username = additionalData.username;
        if (additionalData.phoneNumber) updates.phoneNumber = additionalData.phoneNumber;
        if (additionalData.termsAccepted) updates.termsAccepted = additionalData.termsAccepted;
        if (additionalData.termsAcceptedDate) updates.termsAcceptedDate = additionalData.termsAcceptedDate;
      } else {
        // This is likely an update operation, so only update missing fields
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
      }
      
      // Always ensure email is current
      if (user.email && (!existingData.email || existingData.email !== user.email)) {
        updates.email = user.email;
      }
      
      // Update admin status if needed - FIXED to prevent undefined values
      if (isUserSuperAdmin !== existingData.isSuperAdmin) {
        updates.isSuperAdmin = isUserSuperAdmin;
        // Make sure isAdmin is never undefined
        updates.isAdmin = isUserSuperAdmin || (existingData.isAdmin === true);
      }
      
      // Apply updates if there are any
      if (Object.keys(updates).length > 0) {
        try {
          console.log("Updating existing user document with data:", updates);
          await updateDoc(userRef, updates);
          console.log("✅ User document updated for:", user.email);
        } catch (updateError) {
          console.error("Error updating user document:", updateError);
          
          if (updateError.message.includes("Missing or insufficient permissions")) {
            console.warn("Permission error detected during update. This usually happens if the Firestore security rules don't allow the operation.");
            
            // Save data to localStorage for recovery during next login if we have all required fields
            if (hasAllRequiredFields) {
              console.log("Saving user data to localStorage for recovery during next login");
              localStorage.setItem(`pendingUserData_${user.uid}`, JSON.stringify({
                firstName: additionalData.firstName,
                lastName: additionalData.lastName,
                username: additionalData.username,
                phoneNumber: additionalData.phoneNumber,
                termsAccepted: additionalData.termsAccepted || false,
                termsAcceptedDate: additionalData.termsAcceptedDate || null
              }));
            }
            
            throw updateError; // Rethrow so it can be handled by the caller's retry mechanism
          }
          
          throw updateError;
        }
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
      const userDoc = await getDoc(userRef).catch(err => {
        console.error("Error checking for user document:", err);
        return { exists: () => false };
      });
      
      // Check for pending data in localStorage or sessionStorage first
      const pendingDataKey = `pendingUserData_${user.uid}`;
      const hasPendingLocalData = localStorage.getItem(pendingDataKey) || sessionStorage.getItem(pendingDataKey);
      
      if (hasPendingLocalData) {
        console.log("Auth state change - Found pending data in storage, deferring to login handler for recovery");
        return; // Let the login handler take care of data recovery
      }
      
      if (!userDoc.exists()) {
        // User doesn't have a document yet, create a minimal one
        // This is a fallback only - the signup process should have created a complete document
        console.log("Auth state change - No existing document found for user, creating a minimal one");
        
        // Only create minimal placeholder data - don't attempt to guess fields that should come from signup
        const minimalUserData = {
          email: user.email,
          createdAt: serverTimestamp(),
          // Set boolean fields to false explicitly to avoid undefined values
          isAdmin: false,
          isSuperAdmin: false,
          termsAccepted: false
        };
        
        try {
          await setDoc(userRef, minimalUserData);
          console.log("Auth state change - Created minimal user document");
        } catch (writeError) {
          console.error("Error creating minimal user document:", writeError);
        }
      } else {
        // Document exists, check if it needs basic updates
        console.log("Found existing user document:", userDoc.data());
        
        // Be careful not to overwrite existing user data
        // Only update critical missing fields
        const data = userDoc.data();
        const updates = {};
        
        // Ensure boolean fields are never undefined
        if (data.isAdmin === undefined) updates.isAdmin = false;
        if (data.isSuperAdmin === undefined) updates.isSuperAdmin = false;
        if (data.termsAccepted === undefined) updates.termsAccepted = false;
        
        // Make sure email is set, but don't touch other profile fields
        if (!data.email && user.email) updates.email = user.email;
        
        // Only update if needed
        if (Object.keys(updates).length > 0) {
          try {
            console.log("Updating existing user document with missing fields:", updates);
            await updateDoc(userRef, updates);
            console.log("✅ User document updated with missing fields");
          } catch (updateError) {
            console.error("Error updating user document:", updateError);
          }
        }
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

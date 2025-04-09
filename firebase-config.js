// Import Firebase SDK modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Function to update super admin list
export async function updateSuperAdmins(userUID, addAdmin = true) {
  try {
    const configRef = doc(db, "config", "admin");
    const configDoc = await getDoc(configRef);
    
    let superAdmins = [];
    if (configDoc.exists()) {
      // If it's an array, use it, otherwise convert from single UID to array
      superAdmins = configDoc.data().superAdmins || 
                   (configDoc.data().adminUID ? [configDoc.data().adminUID] : []);
    } else {
      // If no configuration exists yet, start with the default admin
      superAdmins = ["yuoaYY14sINHaqtNK5EAz4nl8cc2"];
    }
    
    if (addAdmin) {
      // Add the user to super admins if not already in the list
      if (!superAdmins.includes(userUID)) {
        superAdmins.push(userUID);
      }
    } else {
      // Remove the user from super admins
      superAdmins = superAdmins.filter(uid => uid !== userUID);
      
      // Ensure at least one super admin remains
      if (superAdmins.length === 0) {
        superAdmins = ["yuoaYY14sINHaqtNK5EAz4nl8cc2"]; // Fallback to default
      }
    }
    
    // Update the super admins list in Firestore
    await setDoc(configRef, {
      superAdmins: superAdmins,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log("✅ Super admins list updated successfully");
    return true;
  } catch (error) {
    console.error("❌ Error updating super admins list:", error);
    return false;
  }
}

// Function to check if a user is a super admin
export async function isSuperAdmin(user) {
  if (!user) return false;
  
  try {
    const configRef = doc(db, "config", "admin");
    const configDoc = await getDoc(configRef);
    
    if (configDoc.exists()) {
      // Check if user is in superAdmins array
      const superAdmins = configDoc.data().superAdmins || [];
      if (superAdmins.includes(user.uid)) {
        return true;
      }
      
      // Legacy check for single adminUID
      const adminUID = configDoc.data().adminUID;
      if (adminUID === user.uid) {
        return true;
      }
    }
    
    // Default super admin check for initial setup
    return user.uid === "yuoaYY14sINHaqtNK5EAz4nl8cc2";
  } catch (error) {
    console.error("❌ Error checking super admin status:", error);
    return user.uid === "yuoaYY14sINHaqtNK5EAz4nl8cc2"; // Fallback to default
  }
}

// Function to create user document in Firestore
export async function createUserDocument(user, additionalData = {}) {
  try {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: user.email,
        firstName: additionalData.firstName || '',
        lastName: additionalData.lastName || '',
        username: additionalData.username || '',
        phoneNumber: additionalData.phoneNumber || '',
        termsAccepted: additionalData.termsAccepted || false,
        termsAcceptedDate: additionalData.termsAcceptedDate || null,
        createdAt: serverTimestamp(),
        isAdmin: false // Default to non-admin
      });
      console.log("✅ User document created for:", user.email);
    }
  } catch (error) {
    console.error("❌ Error creating user document:", error.message);
  }
}

// Function to check if a user is admin
export async function isUserAdmin(user) {
  if (!user) return false;
  try {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);
    return userDoc.exists() ? userDoc.data().isAdmin : false;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Listen for auth state changes to create user documents
onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("📢 User detected:", user.email);
    await createUserDocument(user);
  } else {
    console.log("📢 No user signed in.");
  }
});

// Deprecating these functions but keeping for backward compatibility
export async function updateAdminConfig(newAdminUID) {
  console.warn("updateAdminConfig is deprecated, use updateSuperAdmins instead");
  return updateSuperAdmins(newAdminUID, true);
}

export async function getAdminUID() {
  console.warn("getAdminUID is deprecated, use isSuperAdmin instead");
  try {
    const configRef = doc(db, "config", "admin");
    const configDoc = await getDoc(configRef);
    
    if (configDoc.exists()) {
      // If superAdmins exists and has entries, return the first one
      const superAdmins = configDoc.data().superAdmins;
      if (superAdmins && superAdmins.length > 0) {
        return superAdmins[0];
      }
      
      // Legacy: return adminUID if it exists
      if (configDoc.data().adminUID) {
        return configDoc.data().adminUID;
      }
    }
    
    return "yuoaYY14sINHaqtNK5EAz4nl8cc2"; // Default
  } catch (error) {
    console.error("❌ Error getting admin UID:", error);
    return "yuoaYY14sINHaqtNK5EAz4nl8cc2"; // Fallback to default
  }
}

// Export Firebase instances for use in other modules
export { app, auth, db };

// Import Firebase SDK modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Initialize Firebase with the provided configuration
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Firestore
const auth = getAuth(app);
const db = getFirestore(app);

console.log("Firebase Initialized Successfully!");

// Wait for the DOM to fully load before attaching event listeners
document.addEventListener("DOMContentLoaded", function() {
  // Get reference to the sign-up form (if present) and its input fields
  const signUpForm = document.getElementById('signUpForm');
  if (signUpForm) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');

    // Attach an event listener to handle sign-up form submission
    signUpForm.addEventListener('submit', function(event) {
      event.preventDefault(); // Prevent page reload on form submission

      // Retrieve email and password from input fields
      const email = emailInput.value;
      const password = passwordInput.value;

      // Create a new user with Firebase Authentication using the provided email and password
      createUserWithEmailAndPassword(auth, email, password)
          .then((userCredential) => {
              // On successful account creation, alert the user and redirect to the login page
              const user = userCredential.user;
              alert("Account created successfully!");
              window.location.href = 'login.html';
          })
          .catch((error) => {
              // Log errors and alert the user if account creation fails
              console.error(error.code, error.message);
              alert("Error: " + error.message);
          });
    });
  }
});

// Export auth and db so that other modules (like script.js) can import them
export { auth, db };

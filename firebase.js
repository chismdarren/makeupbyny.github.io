// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";  

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

// Initialize Firebase Authentication
const auth = getAuth();

console.log("Firebase Initialized Successfully!");

// Get reference to the sign-up form and input fields
const signUpForm = document.getElementById('signUpForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// Add event listener to the sign-up form
signUpForm.addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent form submission to avoid page reload

    // Get the email and password entered by the user
    const email = emailInput.value;
    const password = passwordInput.value;

    // Create a new user with email and password using Firebase Authentication
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            // If user creation is successful, the following code will run
            const user = userCredential.user;
            alert("Account created successfully!");
            // Optionally redirect the user to the login page after successful sign-up
            window.location.href = 'login.html';  // Redirect to login page
        })
        .catch((error) => {
            // If there's an error, such as weak password or email already in use
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error(errorCode, errorMessage);
            alert("Error: " + errorMessage);  // Display error message to user
        });
});

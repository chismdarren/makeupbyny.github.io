// Import Firebase essentials from our config
import { auth, db, createUserDocument } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  console.log("Sign-up form page loaded");
  const signUpForm = document.getElementById('signUpForm');
  
  // Get all form fields
  const firstNameInput = document.getElementById('firstName');
  const lastNameInput = document.getElementById('lastName');
  const usernameInput = document.getElementById('username');
  const phoneNumberInput = document.getElementById('phoneNumber');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  
  // Generate username when first or last name changes
  function generateUsername() {
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    
    if (firstName && lastName) {
      // Get first name and first letter of last name, lowercase everything
      const baseUsername = `${firstName}${lastName.charAt(0)}`.toLowerCase();
      
      // Remove special characters and spaces
      let cleanUsername = baseUsername.replace(/[^a-zA-Z0-9]/g, '');
      
      // Set the username
      usernameInput.value = cleanUsername;
    }
  }
  
  // Add input event listeners to generate username
  firstNameInput.addEventListener('input', generateUsername);
  lastNameInput.addEventListener('input', generateUsername);
  
  // Add form submission handler
  if (signUpForm) {
    signUpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      // Basic form validation
      const firstName = firstNameInput.value.trim();
      const lastName = lastNameInput.value.trim();
      const username = usernameInput.value.trim();
      const phoneNumber = phoneNumberInput.value.trim();
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();
      const confirmPassword = confirmPasswordInput.value.trim();
      
      // Validate password
      if (password.length < 6) {
        alert("Password must be at least 6 characters long");
        return;
      }
      
      // Check if passwords match
      if (password !== confirmPassword) {
        alert("Passwords do not match");
        return;
      }
      
      // Validate phone number with regex
      const phoneRegex = /^[0-9]{3}[-\s]?[0-9]{3}[-\s]?[0-9]{4}$/;
      if (!phoneRegex.test(phoneNumber)) {
        alert("Please enter a valid phone number (format: 123-456-7890)");
        return;
      }
      
      try {
        // Check if username already exists in database
        const usersRef = collection(db, "users");
        const usernameQuery = query(usersRef, where("username", "==", username));
        const usernameSnapshot = await getDocs(usernameQuery);
        
        if (!usernameSnapshot.empty) {
          alert("Username already exists. Please use a different username.");
          return;
        }
        
        // Create the user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Store additional user data
        await createUserDocument(user, {
          firstName,
          lastName,
          username,
          phoneNumber
        });
        
        // Show success message and redirect
        alert("✅ Account created successfully!");
        window.location.href = 'login.html';
        
      } catch (error) {
        console.error("❌ Error creating user:", error.message);
        alert("Error: " + error.message);
      }
    });
  } else {
    console.error("Sign up form not found!");
  }
});

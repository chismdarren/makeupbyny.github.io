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
      // Get first name and first letter of last name with proper capitalization
      const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      const lastInitial = lastName.charAt(0).toUpperCase();
      
      // Create username in format "FirstName. LastInitial"
      const formattedUsername = `${capitalizedFirstName}. ${lastInitial}`;
      
      // Set the username
      usernameInput.value = formattedUsername;
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
      const agreeTerms = document.getElementById('agreeTerms').checked;
      
      // Check terms agreement
      if (!agreeTerms) {
        alert("You must agree to the Terms of Service and Privacy Policy to create an account");
        return;
      }
      
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
          // If username exists, try adding a number to make it unique
          let counter = 1;
          let isUnique = false;
          let newUsername = '';
          
          while (!isUnique && counter <= 10) {
            // Format: "FirstName. LastInitial_1"
            newUsername = `${username}_${counter}`;
            const newQuery = query(usersRef, where("username", "==", newUsername));
            const newSnapshot = await getDocs(newQuery);
            
            if (newSnapshot.empty) {
              isUnique = true;
              usernameInput.value = newUsername;
              alert(`Username "${username}" already exists. We've changed it to "${newUsername}".`);
            } else {
              counter++;
            }
          }
          
          if (!isUnique) {
            alert("Username already exists. Please try different names.");
            return;
          }
        }
        
        // Create the user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Get the final username (which might have been updated if there was a duplicate)
        const finalUsername = usernameInput.value.trim();
        
        // Store additional user data - make sure to include ALL user details
        await createUserDocument(user, {
          firstName,
          lastName,
          username: finalUsername,
          phoneNumber,
          email, // Explicitly include email to ensure it's stored in Firestore
          termsAccepted: true,
          termsAcceptedDate: new Date().toISOString()
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

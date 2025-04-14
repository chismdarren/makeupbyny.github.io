// Import Firebase essentials from our config
import { auth, db, createUserDocument } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
      
      // Detailed validation and data logging
      console.log("Signup form data:", { 
        firstName, lastName, username, phoneNumber, email, agreeTerms 
      });
      
      // Missing required fields check
      if (!firstName || !lastName || !username || !phoneNumber || !email || !password) {
        alert("All fields are required. Please complete the form.");
        return;
      }
      
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
        // Format username properly to ensure "FirstName. LastInitial" format
        const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        const lastInitial = lastName.charAt(0).toUpperCase();
        const formattedUsername = `${capitalizedFirstName}. ${lastInitial}`;
        
        // Prepare user data to save
        const userData = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: formattedUsername,
          phoneNumber: phoneNumber.trim(),
          termsAccepted: true,
          termsAcceptedDate: new Date().toISOString()
        };
        
        // Create the user account with Firebase Authentication
        console.log("Creating user authentication account with email:", email);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log("Authentication account created successfully. UID:", user.uid);
        
        // Save user data to localStorage first as a safety measure
        console.log("Saving user data to localStorage as a backup");
        localStorage.setItem(`pendingUserData_${user.uid}`, JSON.stringify(userData));
        
        // Save the user data to Firestore using the createUserDocument function
        let firestoreSaveSuccess = false;
        try {
          console.log("Saving user data to Firestore:", userData);
          await createUserDocument(user, userData);
          console.log("User data saved successfully to Firestore");
          firestoreSaveSuccess = true;
          
          // Double-check that the data was actually saved properly
          const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
          const { db } = await import("./firebase-config.js");
          
          console.log("Verifying user data was saved correctly");
          const userRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const savedData = userDoc.data();
            console.log("Retrieved saved user data:", savedData);
            
            // Check if all fields were saved properly
            const requiredFields = ['firstName', 'lastName', 'username', 'phoneNumber'];
            const missingFields = [];
            
            requiredFields.forEach(field => {
              if (!savedData[field] || savedData[field] === '') {
                missingFields.push(field);
              }
            });
            
            if (missingFields.length > 0) {
              console.warn("Some required fields are missing or empty:", missingFields);
              firestoreSaveSuccess = false;
              throw new Error(`Data was not saved completely. Missing fields: ${missingFields.join(', ')}`);
            } else {
              console.log("All required fields were saved correctly");
              // Now that we're sure data is saved, we can remove the localStorage backup
              localStorage.removeItem(`pendingUserData_${user.uid}`);
            }
          } else {
            console.warn("User document doesn't exist after save attempt");
            firestoreSaveSuccess = false;
            throw new Error("User document doesn't exist after save attempt");
          }
        } catch (firestoreError) {
          console.error("Error saving user data to Firestore:", firestoreError);
          
          // We already saved to localStorage above as a backup
          console.log("User data was already saved to localStorage as fallback");
        }
        
        // Show success message based on save status
        if (firestoreSaveSuccess) {
          alert("✅ Account created successfully! You will now be redirected to the login page.");
        } else {
          alert("✅ Account created, but there was an issue saving some of your information. It will be recovered when you log in.");
        }
        
        // Navigate to login page
        window.location.href = "login.html";
        
      } catch (error) {
        console.error("❌ Error in signup process:", error.message);
        alert("Error: " + error.message);
      }
    });
  } else {
    console.error("Sign up form not found!");
  }
});

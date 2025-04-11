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
        
        // Check if username already exists in database
        const usersRef = collection(db, "users");
        const usernameQuery = query(usersRef, where("username", "==", formattedUsername));
        const usernameSnapshot = await getDocs(usernameQuery);
        
        let finalUsername = formattedUsername;
        
        if (!usernameSnapshot.empty) {
          // If username exists, try adding a number to make it unique
          let counter = 1;
          let isUnique = false;
          
          while (!isUnique && counter <= 10) {
            // Format: "FirstName. LastInitial_1"
            const newUsername = `${formattedUsername}_${counter}`;
            const newQuery = query(usersRef, where("username", "==", newUsername));
            const newSnapshot = await getDocs(newQuery);
            
            if (newSnapshot.empty) {
              isUnique = true;
              finalUsername = newUsername;
              alert(`Username "${formattedUsername}" already exists. We've changed it to "${newUsername}".`);
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
        try {
          console.log("Creating user account with email:", email);
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
          
          // Prepare user data - ensure all fields are trimmed and properly formatted
          const userData = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            username: finalUsername.trim(),
            phoneNumber: phoneNumber.trim(),
            termsAccepted: true,
            termsAcceptedDate: new Date().toISOString()
          };
          
          console.log("User authentication created successfully with UID:", user.uid);
          console.log("User data prepared:", userData);
          
          // Show success message immediately - we don't want the user to wait
          alert("✅ Account created successfully! You can now log in.");
          
          // Handle user data separately - don't block the user experience
          try {
            // Check if we can directly call a Cloud Function instead of using client-side Firestore
            const functionUrl = "https://us-central1-makeupbyny-1.cloudfunctions.net/createUserProfile";
            
            // Attempt to call a function to create the user profile
            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                uid: user.uid,
                email: user.email,
                userData: userData
              })
            });
            
            if (response.ok) {
              console.log("User profile created via Cloud Function");
            } else {
              // Fallback to using our client-side code if the function call fails
              console.warn("Cloud Function call failed, falling back to client approach");
              // Call createUserDocument but ignore errors
              await createUserDocument(user, userData).catch(e => {
                console.error("Failed to create user document:", e);
                // Store data in localStorage as a last resort
                localStorage.setItem(`pendingUserData_${user.uid}`, JSON.stringify(userData));
                console.log("User data saved to localStorage for later recovery");
              });
            }
          } catch (profileError) {
            console.error("Error creating user profile:", profileError);
            // Don't block the user experience even if profile creation fails
            
            // Store in localStorage as a last resort
            localStorage.setItem(`pendingUserData_${user.uid}`, JSON.stringify(userData));
            console.log("User data saved to localStorage for later recovery");
          }
          
          // Redirect user to login page
          window.location.href = 'login.html';
        } catch (authError) {
          console.error("❌ Error creating user authentication:", authError.message);
          alert("Error creating account: " + authError.message);
        }
      } catch (error) {
        console.error("❌ Error in signup process:", error.message);
        alert("Error: " + error.message);
      }
    });
  } else {
    console.error("Sign up form not found!");
  }
});

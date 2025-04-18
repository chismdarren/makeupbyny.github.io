// Import Firebase essentials from our config
import { auth, db, createUserDocument } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
        // IMPORTANT: Disable the submit button to prevent double submission
        const submitButton = signUpForm.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = "Creating Account...";
        }
        
        // First, check if an account with this email already exists
        console.log("Checking if an account with this email already exists:", email);
        let existingAccount = false;
        let existingUser = null;
        
        try {
          // Check Firestore first for existing accounts with this email
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("email", "==", email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            console.log(`Found ${querySnapshot.size} existing accounts with email ${email} in Firestore`);
            existingAccount = true;
            
            // Get the first existing account
            querySnapshot.forEach(doc => {
              if (!existingUser) {
                existingUser = {
                  uid: doc.id,
                  ...doc.data()
                };
              }
            });
          } else {
            // If not found in Firestore, check Firebase Auth
            try {
              const methods = await fetchSignInMethodsForEmail(auth, email);
              if (methods && methods.length > 0) {
                console.log(`Account exists with email ${email} in Authentication, sign-in methods:`, methods);
                existingAccount = true;
                
                // Since we know this email is registered but found no Firestore record,
                // the user likely never completed registration. We'll let them login with their credentials.
                alert("An account with this email already exists. Please log in instead.");
                window.location.href = "index.html";
                return;
              }
            } catch (methodError) {
              console.warn("Error checking sign-in methods:", methodError);
              // Continue with account creation even if check fails
            }
          }
        } catch (checkError) {
          console.warn("Error checking for existing account:", checkError);
          // Continue with account creation if checks fail
        }
        
        // If an existing account was found in Firestore
        if (existingAccount && existingUser) {
          alert("An account with this email already exists. You will be redirected to the home page.");
          window.location.href = "index.html";
          return;
        }
        
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
        
        // IMMEDIATELY save user data to localStorage as a backup
        console.log("Saving user data to localStorage as a backup");
        const pendingDataKey = `pendingUserData_${user.uid}`;
        localStorage.setItem(pendingDataKey, JSON.stringify(userData));
        
        // Also save to sessionStorage as an additional backup
        sessionStorage.setItem(pendingDataKey, JSON.stringify(userData));
        
        // Create a function to verify the user data was saved properly
        const verifyUserData = async () => {
          console.log("Verifying user data was saved correctly");
          const userRef = doc(db, "users", user.uid);
          
          // Retry mechanism for verification with exponential backoff
          let retryCount = 0;
          const maxRetries = 3;
          let delay = 500;
          
          while (retryCount < maxRetries) {
            try {
              const userDoc = await getDoc(userRef);
              
              if (userDoc.exists()) {
                const savedData = userDoc.data();
                console.log(`Verification attempt ${retryCount + 1}: Retrieved saved user data:`, savedData);
                
                // Check if all fields were saved properly
                const requiredFields = ['firstName', 'lastName', 'username', 'phoneNumber'];
                const missingFields = [];
                
                requiredFields.forEach(field => {
                  if (!savedData[field] || savedData[field] === '') {
                    missingFields.push(field);
                  }
                });
                
                if (missingFields.length === 0) {
                  console.log("All required fields were saved correctly");
                  return { success: true, data: savedData };
                } else {
                  console.warn(`Verification attempt ${retryCount + 1}: Fields missing:`, missingFields);
                  
                  // If this is not the last retry, attempt to fix the data
                  if (retryCount < maxRetries - 1) {
                    console.log("Attempting to fix missing fields...");
                    const updates = {};
                    missingFields.forEach(field => {
                      updates[field] = userData[field];
                    });
                    
                    await updateDoc(userRef, updates);
                    console.log("Applied fixes for missing fields:", updates);
                  }
                }
              } else {
                console.warn(`Verification attempt ${retryCount + 1}: User document doesn't exist`);
                
                // If document doesn't exist, recreate it on non-final attempts
                if (retryCount < maxRetries - 1) {
                  // Re-create the entire document with setDoc
                  const fullUserData = {
                    ...userData,
                    email: user.email,
                    createdAt: new Date().toISOString(),
                    isAdmin: false,
                    isSuperAdmin: false
                  };
                  
                  await setDoc(userRef, fullUserData);
                  console.log("Recreated user document with all data");
                }
              }
              
              // Increase retry count and delay
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2; // Exponential backoff
              
            } catch (error) {
              console.error(`Verification error on attempt ${retryCount + 1}:`, error);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            }
          }
          
          // If we got here, verification failed after all retries
          return { success: false };
        };
        
        // Save the user data to Firestore using the createUserDocument function
        let firestoreSaveSuccess = false;
        try {
          console.log("Saving user data to Firestore:", userData);
          
          // First attempt with createUserDocument
          await createUserDocument(user, userData);
          console.log("Initial save to Firestore completed");
          
          // Verify the save was successful and data is complete
          const verificationResult = await verifyUserData();
          firestoreSaveSuccess = verificationResult.success;
          
          if (firestoreSaveSuccess) {
            // Data verified as complete, now safe to remove localStorage backup
            localStorage.removeItem(pendingDataKey);
            sessionStorage.removeItem(pendingDataKey);
            console.log("User data verified and localStorage backup removed");
          } else {
            // Verification failed, try direct method as final attempt
            console.warn("Verification failed after retries, trying direct setDoc as final attempt");
            
            const userRef = doc(db, "users", user.uid);
            const fullUserData = {
              ...userData,
              email: user.email,
              createdAt: new Date().toISOString(),
              isAdmin: false,
              isSuperAdmin: false
            };
            
            // Use merge:true to avoid overwriting any existing data
            await setDoc(userRef, fullUserData, { merge: true });
            console.log("Final direct setDoc attempt completed");
            
            // We'll keep localStorage data just in case - don't remove it
          }
        } catch (firestoreError) {
          console.error("Error saving user data to Firestore:", firestoreError);
          
          // We already saved to localStorage above as a backup
          console.log("Keeping user data in localStorage and sessionStorage for recovery during login");
        }
        
        // Show success message based on save status
        if (firestoreSaveSuccess) {
          alert("✅ Account created successfully! You will now be redirected to the home page.");
        } else {
          alert("✅ Account created, but there was an issue saving some of your information. It will be recovered when you log in.");
        }
        
        // Navigate to home page
        window.location.href = "index.html";
        
      } catch (error) {
        console.error("❌ Error in signup process:", error.message);
        alert("Error: " + error.message);
        
        // Re-enable the submit button if there was an error
        const submitButton = signUpForm.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Create Account";
        }
      }
    });
  } else {
    console.error("Sign up form not found!");
  }
});

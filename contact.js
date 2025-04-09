import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

// Import from firebase-config.js instead of defining config here
import { auth, db, isUserAdmin } from './firebase-config.js';

// Define admin user ID - correct ID from other pages
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Log to verify db is properly imported
console.log("DB reference imported:", db ? "✅ Success" : "❌ Failed");

// DOM elements
const contactForm = document.getElementById("contactForm");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const messageInput = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");
const notification = document.getElementById("notification");
const adminDropdownBtn = document.getElementById("adminDropdownBtn");
const userAccountLink = document.getElementById("userAccountLink");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const settingsIcon = document.getElementById("settingsIcon");

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  // Initially hide user account link and settings icon until auth check completes
  if (userAccountLink) userAccountLink.style.display = "none";
  if (settingsIcon) settingsIcon.style.display = "none";
  
  // Setup form submission
  if (contactForm) {
    console.log("Contact form found in document");
    
    // Create a feedback element
    const feedbackElement = document.createElement('div');
    feedbackElement.id = 'form-feedback';
    feedbackElement.style.padding = '15px';
    feedbackElement.style.margin = '15px 0';
    feedbackElement.style.borderRadius = '4px';
    feedbackElement.style.display = 'none';
    
    // Insert the feedback element after the form
    contactForm.parentNode.insertBefore(feedbackElement, contactForm.nextSibling);
    
    // Add submit event listener to the form
    contactForm.addEventListener('submit', handleFormSubmit);
  }
  
  // Setup dropdowns
  setupDropdowns();
  
  // Setup logout button
  setupLogout();
  
  // Check authentication state
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const adminStatus = await isUserAdmin(user);
      if (adminStatus) {
        document.querySelector('.admin-dropdown').style.display = 'block';
        document.querySelector('.user-dropdown').style.display = 'none';
      } else {
        document.querySelector('.admin-dropdown').style.display = 'none';
        document.querySelector('.user-dropdown').style.display = 'block';
      }
      console.log("User is logged in:", user.email);
      
      // Update UI based on user role
      if (loginLink) loginLink.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline";
      if (userAccountLink) userAccountLink.style.display = "inline";
      
      // Show settings icon when user is logged in
      if (settingsIcon) settingsIcon.style.display = "flex";
      
      // If user is logged in, pre-fill name and email
      if (nameInput && !nameInput.value) {
        nameInput.value = user.displayName || "";
      }
      if (emailInput && !emailInput.value) {
        emailInput.value = user.email || "";
      }
    } else {
      console.log("User is not logged in");
      
      // Update UI for logged out state
      if (loginLink) loginLink.style.display = "inline";
      if (logoutBtn) logoutBtn.style.display = "none";
      if (userAccountLink) userAccountLink.style.display = "none";
      if (adminDropdownBtn) adminDropdownBtn.style.display = "none";
      if (settingsIcon) settingsIcon.style.display = "none";
      window.location.href = 'login.html';
    }
  });
});

// Set up dropdowns
function setupDropdowns() {
  // Admin dropdown
  if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById("adminDropdownContent").classList.toggle("show-dropdown");
      this.classList.toggle("active");
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener("click", function(e) {
    if (!e.target.matches(".admin-dropdown-btn")) {
      const dropdowns = document.querySelectorAll(".admin-dropdown-content");
      dropdowns.forEach(dropdown => {
        if (dropdown.classList.contains("show-dropdown")) {
          dropdown.classList.remove("show-dropdown");
          
          // Also remove active class from buttons
          if (adminDropdownBtn) adminDropdownBtn.classList.remove("active");
        }
      });
    }
  });
}

// Set up logout
function setupLogout() {
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
}

// Handle logout
function handleLogout() {
  signOut(auth).then(() => {
    console.log("User signed out");
    window.location.href = "index.html";
  }).catch(error => {
    console.error("Error signing out:", error);
  });
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();
  
  // Validate form
  if (!nameInput.value || !emailInput.value || !messageInput.value) {
    showNotification("Please fill out all fields.", "error");
    return;
  }
  
  // Disable submit button to prevent multiple submissions
  submitBtn.disabled = true;
  submitBtn.innerHTML = "Sending...";
  
  try {
    // Add document to contact_messages collection
    await addDoc(collection(db, "contact_messages"), {
      name: nameInput.value,
      email: emailInput.value,
      message: messageInput.value,
      createdAt: serverTimestamp(),
      read: false
    });
    
    // Clear form
    contactForm.reset();
    
    // Show success message
    showNotification("Your message has been sent successfully! We'll get back to you soon.", "success");
  } catch (error) {
    console.error("Error sending message:", error);
    showNotification("There was an error sending your message. Please try again later.", "error");
  } finally {
    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.innerHTML = "Send Message";
  }
}

// Show notification
function showNotification(message, type) {
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = "block";
  
  // Hide notification after 5 seconds
  setTimeout(() => {
    notification.style.display = "none";
  }, 5000);
} 
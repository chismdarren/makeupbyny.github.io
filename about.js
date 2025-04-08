// Import necessary Firebase modules
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Define admin user ID for special privileges
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Get DOM elements
const adminDropdownBtn = document.getElementById("adminDropdownBtn");
const adminDropdownContent = document.getElementById("adminDropdownContent");
const userAccountLink = document.getElementById("userAccountLink");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const settingsIcon = document.getElementById("settingsIcon");

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Initially hide user account link until auth check completes
  if (userAccountLink) userAccountLink.style.display = "none";
  if (settingsIcon) settingsIcon.style.display = "none";
  
  // Set up dropdowns
  setupDropdowns();
  
  // Set up logout button
  setupLogout();
  
  // Monitor user authentication state
  onAuthStateChanged(auth, handleAuthStateChange);

  // Add smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Add animation to about cards on scroll
  const observerOptions = {
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
      }
    });
  }, observerOptions);

  // Observe all about cards
  document.querySelectorAll('.about-card').forEach(card => {
    observer.observe(card);
  });
});

// Handle authentication state changes
function handleAuthStateChange(user) {
  if (user) {
    console.log("User is logged in:", user.email);
    
    // Update UI based on user role
    if (loginLink) loginLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline";
    if (userAccountLink) userAccountLink.style.display = "inline";
    if (settingsIcon) settingsIcon.style.display = "flex";
    
    // Check if user is admin
    const isAdmin = user.uid === adminUID;
    
    if (isAdmin && adminDropdownBtn) {
      // Show admin dropdown button
      adminDropdownBtn.style.display = "inline";
    } else if (adminDropdownBtn) {
      // Hide admin dropdown button for regular users
      adminDropdownBtn.style.display = "none";
    }
  } else {
    // If user is not logged in, show login button and hide user features
    if (loginLink) loginLink.style.display = "inline";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userAccountLink) userAccountLink.style.display = "none";
    if (adminDropdownBtn) adminDropdownBtn.style.display = "none";
    if (settingsIcon) settingsIcon.style.display = "none";
  }
}

// Set up dropdowns
function setupDropdowns() {
  // Admin dropdown
  if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (adminDropdownContent) {
        adminDropdownContent.classList.toggle("show-dropdown");
        this.classList.toggle("active");
      }
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener("click", function(e) {
    if (adminDropdownBtn && adminDropdownContent && 
        !e.target.matches('#adminDropdownBtn') && 
        !e.target.matches('.dropdown-icon')) {
      if (adminDropdownContent.classList.contains("show-dropdown")) {
        adminDropdownContent.classList.remove("show-dropdown");
        adminDropdownBtn.classList.remove("active");
      }
    }
  });
}

// Set up logout
function setupLogout() {
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function() {
      signOut(auth).then(() => {
        console.log("User signed out");
        window.location.href = "index.html";
      }).catch(error => {
        console.error("Error signing out:", error);
      });
    });
  }
} 
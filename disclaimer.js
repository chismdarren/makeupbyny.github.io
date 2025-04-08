// Import necessary Firebase modules
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Define admin user ID for special privileges
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Monitor user authentication state
  onAuthStateChanged(auth, (user) => {
    // If user is logged in
    if (user) {
      // Hide login button, show logout button and account link
      document.getElementById("login-link").style.display = "none";
      document.getElementById("logout-btn").style.display = "inline";
      document.getElementById("userAccountLink").style.display = "inline";
      
      // Show settings icon
      const settingsIcon = document.getElementById('settingsIcon');
      if (settingsIcon) settingsIcon.style.display = 'flex';

      // Check if user is admin
      if (user.uid === adminUID) {
        // Show admin dropdown button
        document.getElementById("adminDropdownBtn").style.display = "inline";
      } else {
        // Hide admin dropdown button for regular users
        document.getElementById("adminDropdownBtn").style.display = "none";
      }
    } else {
      // If user is not logged in, show login button and hide user features
      document.getElementById("login-link").style.display = "inline";
      document.getElementById("logout-btn").style.display = "none";
      document.getElementById("userAccountLink").style.display = "none";
      document.getElementById("adminDropdownBtn").style.display = "none";
      
      // Hide settings icon
      const settingsIcon = document.getElementById('settingsIcon');
      if (settingsIcon) settingsIcon.style.display = 'none';
    }
  });

  // Handle logout button click
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  // Toggle dropdown menu on click
  const adminDropdownBtn = document.getElementById("adminDropdownBtn");
  if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener("click", function(e) {
      e.preventDefault(); // Prevent default link behavior
      this.classList.toggle("active");
      document.getElementById("adminDropdownContent").classList.toggle("show-dropdown");
    });
  }

  // Close dropdown when clicking outside
  window.addEventListener("click", function(e) {
    if (!e.target.matches('#adminDropdownBtn') && !e.target.matches('.dropdown-icon')) {
      const dropdown = document.getElementById("adminDropdownContent");
      const btn = document.getElementById("adminDropdownBtn");
      if (dropdown && dropdown.classList.contains("show-dropdown")) {
        dropdown.classList.remove("show-dropdown");
        btn.classList.remove("active");
      }
    }
  });
});

// Handle logout functionality
function handleLogout() {
  signOut(auth).then(() => {
    console.log('User signed out');
    window.location.href = 'index.html';
  }).catch(error => {
    console.error('Error signing out:', error);
  });
} 
// Import necessary Firebase modules
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Define admin user ID for special privileges
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Monitor user authentication state
  onAuthStateChanged(auth, (user) => {
    // If user is logged in
    if (user) {
      // Hide login button, show logout button
      document.getElementById("login-link").style.display = "none";
      document.getElementById("logout-btn").style.display = "inline";

      // Check if user is admin
      if (user.uid === adminUID) {
        // Show admin-only navigation items
        document.getElementById("adminDashboard").style.display = "inline";
        document.getElementById("createPost").style.display = "inline";
        document.getElementById("manageUsers").style.display = "inline";
      } else {
        // Hide admin-only navigation items for regular users
        document.getElementById("adminDashboard").style.display = "none";
        document.getElementById("createPost").style.display = "none";
        document.getElementById("manageUsers").style.display = "none";
      }
    } else {
      // If user is not logged in, show login button and hide admin features
      document.getElementById("login-link").style.display = "inline";
      document.getElementById("logout-btn").style.display = "none";
      document.getElementById("adminDashboard").style.display = "none";
      document.getElementById("createPost").style.display = "none";
      document.getElementById("manageUsers").style.display = "none";
    }
  });

  // Handle logout button click
  document.getElementById("logout-btn").addEventListener("click", () => {
    auth.signOut().then(() => {
      window.location.href = "index.html";
    });
  });
}); 
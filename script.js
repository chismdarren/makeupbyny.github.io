// Import Firebase Authentication at the top
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase.js";

// Attempt to select login/logout and create post elements
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const createPostLink = document.getElementById("create-post-link");

// Only run the auth state changed code if these elements exist
if (loginLink && logoutBtn && createPostLink) {
  onAuthStateChanged(auth, (user) => {
      if (user) {
          loginLink.style.display = "none";  // Hide login link
          logoutBtn.style.display = "block"; // Show logout button
          createPostLink.style.display = "inline"; // Show "Create a Post"
      } else {
          loginLink.style.display = "block";  // Show login link
          logoutBtn.style.display = "none";   // Hide logout button
          createPostLink.style.display = "none"; // Hide "Create a Post"
      }
  });
}

// Attach logout functionality only if logoutBtn exists
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
          window.location.href = "index.html"; // Redirect to homepage
      });
  });
}

// Wait for the DOM to fully load and then attach the form submission listener
document.addEventListener("DOMContentLoaded", function () {
  const postForm = document.getElementById("postForm");
  if (postForm) {
      postForm.addEventListener("submit", function (event) {
          event.preventDefault();
          let title = document.getElementById("title").value;
          let content = document.getElementById("content").value;
          console.log("Form submitted");
          console.log("Title:", title);
          console.log("Content:", content);
          alert(`Post submitted: ${title}`);
          // Here, you can add code to actually save the post data.
      });
  } else {
      console.log("postForm not found!");
  }
});

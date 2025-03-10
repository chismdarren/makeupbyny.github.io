// Import Firebase Authentication functions and auth from firebase.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase.js";

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Select login/logout and create post elements (if they exist on this page)
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const createPostLink = document.getElementById("create-post-link");

  // Only run the auth state code if these elements exist
  if (loginLink && logoutBtn && createPostLink) {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        loginLink.style.display = "none";      // Hide login link
        logoutBtn.style.display = "block";       // Show logout button
        createPostLink.style.display = "inline"; // Show "Create a Post" link
      } else {
        loginLink.style.display = "block";       // Show login link
        logoutBtn.style.display = "none";        // Hide logout button
        createPostLink.style.display = "none";     // Hide "Create a Post" link
      }
    });
  }

  // Attach logout functionality if the logout button exists
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
        window.location.href = "index.html"; // Redirect to homepage after sign-out
      });
    });
  }

  // Attach the post form submission handler (if the post form exists)
  const postForm = document.getElementById("postForm");
  // Get the container where new posts will be appended
  const postsContainer = document.getElementById("postsContainer");

  if (postForm) {
    postForm.addEventListener("submit", function (event) {
      event.preventDefault();
      let title = document.getElementById("title").value;
      let content = document.getElementById("content").value;
      
      console.log("Form submitted");
      console.log("Title:", title);
      console.log("Content:", content);
      alert(`Post submitted: ${title}`);

      // Create a new element to display the post
      const postElement = document.createElement("div");
      postElement.innerHTML = `<h3>${title}</h3><p>${content}</p>`;

      // Append the new post element to the container if it exists
      if (postsContainer) {
        postsContainer.appendChild(postElement);
      }
      
      // Optionally, clear the form fields after submission
      postForm.reset();
    });
  }
});

// Import Firebase Authentication at the top
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase.js";  // Ensure auth is properly exported in firebase.js

// Select login/logout and create post elements
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const createPostLink = document.getElementById("create-post-link");

// Check if user is logged in
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

// Logout function
logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
        window.location.href = "index.html"; // Redirect to homepage
    });
});

// Simple script to handle form submissions (for now, it logs the data)
document.addEventListener("DOMContentLoaded", function () {
    const postForm = document.getElementById("postForm");

    if (postForm) {
        postForm.addEventListener("submit", function (event) {
            event.preventDefault();
            let title = document.getElementById("title").value;
            let content = document.getElementById("content").value;
            console.log("Title:", title);
            console.log("Content:", content);
        });
    }
});
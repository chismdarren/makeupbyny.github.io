import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

// Define admin user ID - correct ID from other pages
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Get DOM elements
const adminDashboard = document.getElementById("adminDashboard");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const recentPostsList = document.getElementById("recentPostsList");

// Handle authentication state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    loginLink.style.display = "none";
    logoutBtn.style.display = "inline";

    // Check if user is admin
    if (user.uid === adminUID) {
      adminDashboard.style.display = "inline";
    } else {
      adminDashboard.style.display = "none";
    }
  } else {
    // User is signed out
    loginLink.style.display = "inline";
    logoutBtn.style.display = "none";
    adminDashboard.style.display = "none";
  }
});

// Handle logout
logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (error) {
    console.error("Error signing out:", error);
  }
});

// Load recent posts
async function loadRecentPosts() {
  try {
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(5));
    const querySnapshot = await getDocs(postsQuery);
    
    recentPostsList.innerHTML = "";
    
    querySnapshot.forEach((doc) => {
      const post = doc.data();
      const postElement = document.createElement("a");
      postElement.href = `post.html?postId=${doc.id}`;
      postElement.className = "recent-post-item";
      
      // Create thumbnail image or placeholder
      const imageHtml = post.imageUrl 
        ? `<img src="${post.imageUrl}" alt="${post.title}">`
        : `<div style="width: 60px; height: 60px; background-color: #f0f0f0; border-radius: 8px;"></div>`;
      
      postElement.innerHTML = `
        ${imageHtml}
        <div class="post-title">${post.title}</div>
      `;
      
      recentPostsList.appendChild(postElement);
    });
  } catch (error) {
    console.error("Error loading recent posts:", error);
  }
}

// Handle FAQ toggle functionality
document.addEventListener("DOMContentLoaded", () => {
  // Load recent posts
  loadRecentPosts();

  // Add click event listeners to FAQ questions
  const faqQuestions = document.querySelectorAll(".faq-question");
  faqQuestions.forEach((question) => {
    question.addEventListener("click", () => {
      const answer = question.nextElementSibling;
      const toggle = question.querySelector(".faq-toggle");
      
      // Toggle answer visibility
      answer.classList.toggle("show");
      toggle.textContent = answer.classList.contains("show") ? "▲" : "▼";
    });
  });
}); 
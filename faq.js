import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { auth, db, isAdminUser } from "./firebase-config.js";

// Get DOM elements
const adminDropdownBtn = document.getElementById("adminDropdownBtn");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const userAccountLink = document.getElementById("userAccountLink");
const settingsIcon = document.getElementById("settingsIcon");
const recentPostsList = document.getElementById("recentPostsList");

// Handle authentication state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in
    loginLink.style.display = "none";
    logoutBtn.style.display = "inline";
    userAccountLink.style.display = "inline";
    
    // Show settings icon for logged in users
    if (settingsIcon) settingsIcon.style.display = "flex";

    // Check if user is admin
    const isAdmin = await isAdminUser(user.uid);
    if (isAdmin) {
      adminDropdownBtn.style.display = "inline";
    } else {
      adminDropdownBtn.style.display = "none";
    }
  } else {
    // User is signed out
    loginLink.style.display = "inline";
    logoutBtn.style.display = "none";
    userAccountLink.style.display = "none";
    adminDropdownBtn.style.display = "none";
    
    // Hide settings icon for anonymous users
    if (settingsIcon) settingsIcon.style.display = "none";
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
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(3));
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

  // Toggle dropdown menu on click
  adminDropdownBtn.addEventListener("click", function(e) {
    e.preventDefault(); // Prevent default link behavior
    this.classList.toggle("active");
    document.getElementById("adminDropdownContent").classList.toggle("show-dropdown");
  });

  // Close dropdown when clicking outside
  window.addEventListener("click", function(e) {
    if (!e.target.matches('#adminDropdownBtn') && !e.target.matches('.dropdown-icon')) {
      const dropdown = document.getElementById("adminDropdownContent");
      const btn = document.getElementById("adminDropdownBtn");
      if (dropdown.classList.contains("show-dropdown")) {
        dropdown.classList.remove("show-dropdown");
        btn.classList.remove("active");
      }
    }
  });
}); 
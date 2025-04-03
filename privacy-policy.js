import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";

// Define admin user ID - correct ID from other pages
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Get DOM elements
const adminDropdownBtn = document.getElementById("adminDropdownBtn");
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
      adminDropdownBtn.style.display = "inline";
    } else {
      adminDropdownBtn.style.display = "none";
    }
  } else {
    // User is signed out
    loginLink.style.display = "inline";
    logoutBtn.style.display = "none";
    adminDropdownBtn.style.display = "none";
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

// Initialize page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Load recent posts
  loadRecentPosts();
  
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
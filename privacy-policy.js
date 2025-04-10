import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { auth, db, isAdminUser } from "./firebase-config.js";

// Get DOM elements
const adminDropdownBtn = document.getElementById("adminDropdownBtn");
const userAccountLink = document.getElementById("userAccountLink");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const settingsIcon = document.getElementById("settingsIcon");
const recentPostsList = document.getElementById("recentPostsList");

// Handle authentication state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in
    loginLink.style.display = "none";
    logoutBtn.style.display = "inline";
    userAccountLink.style.display = "inline";
    settingsIcon.style.display = "flex";

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
    settingsIcon.style.display = "none";
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
  console.log('Privacy Policy page loaded');
  
  // Initially hide user account link until auth check completes
  if (userAccountLink) userAccountLink.style.display = 'none';
  if (settingsIcon) settingsIcon.style.display = 'none';
  
  // Set up dropdown functionality
  setupDropdowns();
  
  // Set up logout button
  setupLogout();
  
  // Load recent posts
  loadRecentPosts();
});

// Set up dropdowns
function setupDropdowns() {
  // Admin dropdown
  if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('adminDropdownContent').classList.toggle('show-dropdown');
      this.classList.toggle('active');
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.matches('.admin-dropdown-btn')) {
      const dropdowns = document.querySelectorAll('.admin-dropdown-content');
      dropdowns.forEach(dropdown => {
        if (dropdown.classList.contains('show-dropdown')) {
          dropdown.classList.remove('show-dropdown');
          
          // Also remove active class from buttons
          if (adminDropdownBtn) adminDropdownBtn.classList.remove('active');
        }
      });
    }
  });
}

// Set up logout
function setupLogout() {
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// Handle logout
function handleLogout() {
  signOut(auth).then(() => {
    console.log('User signed out');
    window.location.href = 'index.html';
  }).catch(error => {
    console.error('Error signing out:', error);
  });
}

// Handle authentication state changes
async function handleAuthStateChange(user) {
  if (user) {
    console.log('User is logged in:', user.email);
    
    // Update UI based on user role
    if (loginLink) loginLink.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline';
    if (userAccountLink) userAccountLink.style.display = 'inline';
    
    // Show admin dropdown based on role
    const isAdmin = await isAdminUser(user.uid);
    if (adminDropdownBtn) adminDropdownBtn.style.display = isAdmin ? 'inline' : 'none';
    
    // Show settings icon when user is logged in
    if (settingsIcon) settingsIcon.style.display = 'flex';
  } else {
    console.log('User is not logged in');
    
    // Update UI for logged out state
    if (loginLink) loginLink.style.display = 'inline';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userAccountLink) userAccountLink.style.display = 'none';
    if (adminDropdownBtn) adminDropdownBtn.style.display = 'none';
    if (settingsIcon) settingsIcon.style.display = 'none';
  }
} 
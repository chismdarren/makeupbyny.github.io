// Import Firebase Authentication functions and auth from firebase-config.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth, app } from "./firebase-config.js";

// Import Firestore functions
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Initialize Firestore
const db = getFirestore();

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing event listeners...");

  // Handle authentication state
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const createPostLink = document.getElementById("create-post-link");

  if (loginLink && logoutBtn && createPostLink) {
    onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed. Current user:", user ? user.uid : "No user");

      if (user) {
        loginLink.style.display = "none";
        logoutBtn.style.display = "block";
        createPostLink.style.display = "inline";
      } else {
        loginLink.style.display = "block";
        logoutBtn.style.display = "none";
        createPostLink.style.display = "none";
      }
    });
  }

  // Handle logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
        console.log("User signed out.");
        window.location.href = "index.html";
      });
    });
  }

  // Load recent posts
  loadRecentPosts();
});

// Function to load and display recent posts
async function loadRecentPosts() {
  try {
    console.log('Loading recent posts...');
    const recentPostsList = document.getElementById('recentPostsList');
    if (!recentPostsList) {
      console.error('Recent posts list element not found');
      return;
    }

    // Show loading state
    recentPostsList.innerHTML = '<p>Loading recent posts...</p>';

    // Get recent posts from Firestore
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const querySnapshot = await getDocs(q);
    console.log('Query completed. Number of posts found:', querySnapshot.size);

    if (querySnapshot.empty) {
      console.log('No posts found');
      recentPostsList.innerHTML = '<p>No posts available.</p>';
      return;
    }

    // Clear existing posts
    recentPostsList.innerHTML = '';

    // Add each post to the list
    querySnapshot.forEach((doc) => {
      const post = { id: doc.id, ...doc.data() };
      const postElement = createRecentPostElement(post);
      recentPostsList.appendChild(postElement);
    });
  } catch (error) {
    console.error('Error loading recent posts:', error);
    const recentPostsList = document.getElementById('recentPostsList');
    if (recentPostsList) {
      recentPostsList.innerHTML = '<p>Error loading recent posts. Please try again later.</p>';
    }
  }
}

// Function to create a recent post element
function createRecentPostElement(post) {
  const div = document.createElement('div');
  div.className = 'recent-post';
  
  // Format date
  const postDate = post.createdAt ? new Date(post.createdAt.seconds * 1000) : new Date();
  const formattedDate = postDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create post content
  div.innerHTML = `
    <h3><a href="post.html?postId=${post.id}">${post.title || 'Untitled Post'}</a></h3>
    <div class="post-meta">
      <span>${formattedDate}</span>
      <span class="status-badge status-${post.status || 'draft'}">${post.status || 'Draft'}</span>
    </div>
  `;

  return div;
} 
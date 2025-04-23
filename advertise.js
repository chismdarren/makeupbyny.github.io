import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, limit, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Define admin user ID
const ADMIN_USER_ID = "your-admin-user-id";

// Get DOM elements
const mainNav = document.getElementById("mainNav");
const adminDashboard = document.getElementById("adminDashboard");
const createPost = document.getElementById("createPost");
const manageUsers = document.getElementById("manageUsers");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const recentPostsList = document.getElementById("recentPostsList");
const advertiseForm = document.getElementById("advertiseForm");

// Initialize Firebase Auth and Firestore
const auth = getAuth();
const db = getFirestore();

// Handle authentication state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in
    loginLink.style.display = "none";
    logoutBtn.style.display = "block";

    // Check if user is admin
    if (user.uid === ADMIN_USER_ID) {
      adminDashboard.style.display = "block";
      createPost.style.display = "block";
      manageUsers.style.display = "block";
    }
  } else {
    // User is signed out
    loginLink.style.display = "block";
    logoutBtn.style.display = "none";
    adminDashboard.style.display = "none";
    createPost.style.display = "none";
    manageUsers.style.display = "none";
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
      const postElement = document.createElement("div");
      postElement.className = "recent-post";
      postElement.innerHTML = `
        <a href="post.html?id=${doc.id}">${post.title}</a>
        <span class="post-date">${new Date(post.createdAt.toDate()).toLocaleDateString()}</span>
      `;
      recentPostsList.appendChild(postElement);
    });
  } catch (error) {
    console.error("Error loading recent posts:", error);
  }
}

// Handle form submission
advertiseForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const formData = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    company: document.getElementById("company").value,
    message: document.getElementById("message").value,
    submittedAt: new Date()
  };

  try {
    await addDoc(collection(db, "advertising-inquiries"), formData);
    alert("Thank you for your interest! We'll get back to you soon.");
    advertiseForm.reset();
  } catch (error) {
    console.error("Error submitting form:", error);
    alert("There was an error submitting your message. Please try again later.");
  }
});

// Initialize page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  loadRecentPosts();
}); 
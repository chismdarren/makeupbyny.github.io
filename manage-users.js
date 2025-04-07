// Import auth and db from firebase-config.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// DOM elements
const userList = document.getElementById("user-list");
const modal = document.getElementById("userModal");
const modalContent = document.getElementById("modalContent");
const closeBtn = document.getElementsByClassName("close")[0];
const content = document.getElementById("content");
let currentUserId = null;

// Admin UID
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";
const adminDropdownBtn = document.getElementById("adminDropdownBtn");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");

// Check authentication and admin status
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state changed. Current user:", user ? user.uid : "No user");
  if (!user) {
    console.log("No user logged in, redirecting to login page");
    window.location.href = "login.html";
    return;
  }

  if (user.uid !== adminUID) {
    console.log("User is not admin, redirecting to home page");
    content.innerHTML = '<div class="error-message">Access denied. Admin privileges required.</div>';
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
    return;
  }

  // Set display state for auth UI elements
  if (loginLink) loginLink.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline";
  if (adminDropdownBtn) adminDropdownBtn.style.display = "inline";

  console.log("User is admin, loading users...");
  // User is admin, load the users
  await loadUsers();
});

// Handle admin dropdown functionality
if (adminDropdownBtn) {
  adminDropdownBtn.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById("adminDropdownContent").classList.toggle("show-dropdown");
    this.classList.toggle("active");
  });
  
  // Close dropdown when clicking outside
  document.addEventListener("click", function(e) {
    if (!e.target.matches('#adminDropdownBtn') && !e.target.matches('.dropdown-icon')) {
      const dropdown = document.getElementById("adminDropdownContent");
      const btn = document.getElementById("adminDropdownBtn");
      if (dropdown && dropdown.classList.contains("show-dropdown")) {
        dropdown.classList.remove("show-dropdown");
        btn.classList.remove("active");
      }
    }
  });
}

// Close modal when clicking the X
if (closeBtn) {
  closeBtn.onclick = function() {
    modal.style.display = "none";
  };
}

// Close modal when clicking outside
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
};

async function loadUserComments(userId) {
  try {
    const commentsQuery = query(collection(db, "posts"), where("comments", "array-contains", userId));
    const querySnapshot = await getDocs(commentsQuery);
    let commentsHtml = '<h3>User Comments</h3>';
    
    if (querySnapshot.empty) {
      commentsHtml += '<p>No comments found for this user.</p>';
    } else {
      commentsHtml += '<div class="comments-list">';
      querySnapshot.forEach((doc) => {
        const postData = doc.data();
        if (postData.comments) {
          postData.comments.forEach(comment => {
            if (comment.userId === userId) {
              commentsHtml += `
                <div class="comment-item">
                  <p><strong>Post:</strong> ${postData.title}</p>
                  <p><strong>Comment:</strong> ${comment.text}</p>
                  <p><strong>Date:</strong> ${new Date(comment.createdAt.toDate()).toLocaleString()}</p>
                </div>
              `;
            }
          });
        }
      });
      commentsHtml += '</div>';
    }
    return commentsHtml;
  } catch (error) {
    console.error("Error loading comments:", error);
    return '<p>Error loading comments.</p>';
  }
}

async function loadUsers() {
  try {
    console.log("Starting to load users...");
    // Fetch user data from the Cloud Function with appropriate headers
    const response = await fetch("https://us-central1-makeupbyny-1.cloudfunctions.net/listAllAuthUsers", {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const users = await response.json();
    console.log("Users received:", users.length);

    userList.innerHTML = ""; // Clear existing list

    // Check if there are users
    if (users.length === 0) {
      console.log("No users found");
      userList.innerHTML = '<li class="user-item">No users found.</li>';
      return;
    }

    // Loop through each user and create an HTML list item
    users.forEach(async user => {
      console.log("Processing user:", user.email);
      
      // Get user's admin status from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : { isAdmin: false };
      
      const li = document.createElement("li");
      li.className = "user-item";
      li.innerHTML = `
        <div class="user-info">
          <strong>Email:</strong> ${user.email} | 
          <strong>UID:</strong> ${user.uid} | 
          <strong>Status:</strong> ${user.disabled ? 'Disabled' : 'Active'} |
          <strong>Role:</strong> <span class="user-role ${userData.isAdmin ? 'admin-role' : 'user-role'}">${userData.isAdmin ? 'Admin' : 'User'}</span>
        </div>
        <div class="user-actions">
          <button onclick="window.showUserDetails('${user.uid}', ${JSON.stringify({...user, isAdmin: userData.isAdmin})})">View Details</button>
          <button class="role-btn ${userData.isAdmin ? 'remove-admin' : 'make-admin'}" onclick="window.updateUserRole('${user.uid}', ${!userData.isAdmin})">${userData.isAdmin ? 'Remove Admin' : 'Make Admin'}</button>
          <button class="delete-btn" onclick="window.deleteUser('${user.uid}')">Delete</button>
        </div>
      `;
      userList.appendChild(li);
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    userList.innerHTML = '<li class="user-item">Error loading users.</li>';
  }
}

// Make functions available globally for onclick handlers
window.showUserDetails = async function(userId, userData) {
  currentUserId = userId;
  const commentsHtml = await loadUserComments(userId);
  
  modalContent.innerHTML = `
    <div>
      <p><strong>Email:</strong> ${userData.email}</p>
      <p><strong>UID:</strong> ${userData.uid}</p>
      <p><strong>Status:</strong> ${userData.disabled ? 'Disabled' : 'Active'}</p>
      <p><strong>Role:</strong> <span class="user-role ${userData.isAdmin ? 'admin-role' : 'user-role'}">${userData.isAdmin ? 'Admin' : 'User'}</span></p>
      <div class="user-actions" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
        <h3>User Management</h3>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button class="role-btn ${userData.isAdmin ? 'remove-admin' : 'make-admin'}" onclick="window.updateUserRole('${userId}', ${!userData.isAdmin})">
            ${userData.isAdmin ? 'Remove Admin' : 'Make Admin'}
          </button>
          <button class="delete-btn" onclick="window.deleteUser('${userId}')">Delete User</button>
        </div>
      </div>
      ${commentsHtml}
    </div>
  `;
  modal.style.display = "block";
};

window.updateUserRole = async function(userId, isAdmin) {
  try {
    // First update the UI to provide immediate feedback
    // Find the list item containing this user by iterating through all user items
    const userItems = document.querySelectorAll('.user-item');
    let userItem = null;
    userItems.forEach(item => {
      if (item.innerHTML.includes(userId)) {
        userItem = item;
      }
    });
    
    if (userItem) {
      const roleSpan = userItem.querySelector('.user-role');
      const roleButton = userItem.querySelector('.role-btn');
      
      if (roleSpan) {
        roleSpan.textContent = isAdmin ? 'Admin' : 'User';
        roleSpan.className = `user-role ${isAdmin ? 'admin-role' : 'user-role'}`;
      }
      
      if (roleButton) {
        roleButton.textContent = isAdmin ? 'Remove Admin' : 'Make Admin';
        roleButton.className = `role-btn ${isAdmin ? 'remove-admin' : 'make-admin'}`;
      }
    }
    
    // Update in Firestore
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { isAdmin });
    
    // Show success message
    const message = document.createElement('div');
    message.className = 'success-message';
    message.textContent = `User ${isAdmin ? 'promoted to admin' : 'removed from admin role'} successfully`;
    message.style.position = 'fixed';
    message.style.top = '20px';
    message.style.left = '50%';
    message.style.transform = 'translateX(-50%)';
    message.style.backgroundColor = '#4CAF50';
    message.style.color = 'white';
    message.style.padding = '10px 20px';
    message.style.borderRadius = '5px';
    message.style.zIndex = '1000';
    document.body.appendChild(message);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
      document.body.removeChild(message);
    }, 3000);
    
    // If a modal is currently displayed, update it too
    if (currentUserId === userId && modal.style.display === "block") {
      const modalRoleText = Array.from(modalContent.querySelectorAll('p')).find(p => p.textContent.includes('Role'));
      if (modalRoleText) {
        modalRoleText.innerHTML = `<strong>Role:</strong> ${isAdmin ? 'Admin' : 'User'}`;
      }
      
      const modalRoleButton = Array.from(modalContent.querySelectorAll('button')).find(btn => 
        btn.textContent.includes('Admin'));
      if (modalRoleButton) {
        modalRoleButton.textContent = isAdmin ? 'Remove Admin' : 'Make Admin';
        modalRoleButton.onclick = function() { window.updateUserRole(userId, !isAdmin); };
      }
    }
  } catch (error) {
    console.error("Error updating user role:", error);
    alert("Error updating user role: " + error.message);
  }
};

window.deleteUser = async function(uid) {
  if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
    try {
      const response = await fetch(`https://us-central1-makeupbyny-1.cloudfunctions.net/deleteUser?uid=${uid}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert("User deleted successfully");
        await loadUsers(); // Reload the list
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Error deleting user");
    }
  }
};

// Handle logout
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => {
      console.log("User signed out.");
      window.location.href = "index.html";
    });
  });
} 
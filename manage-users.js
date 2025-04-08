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
  getDoc,
  deleteDoc,
  orderBy
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
const adminDropdownContent = document.getElementById("adminDropdownContent");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const userAccountLink = document.getElementById("userAccountLink");
const settingsIcon = document.getElementById("settingsIcon");
const usersTableBody = document.getElementById("usersTableBody");
const userCountElement = document.getElementById("userCount");
const userSearchInput = document.getElementById("userSearch");
const loadingSpinner = document.getElementById("loadingSpinner");
const userDetailModal = document.getElementById("userDetailModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const editUserForm = document.getElementById("editUserForm");
const deleteUserBtn = document.getElementById("deleteUserBtn");

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  console.log("User Management page loaded");

  // Initially hide user account link and settings icon until auth check completes
  if (userAccountLink) userAccountLink.style.display = "none";
  if (settingsIcon) settingsIcon.style.display = "none";
  
  // Set up dropdowns
  setupDropdowns();
  
  // Set up logout button
  setupLogout();
  
  // Set up search functionality
  setupSearch();
  
  // Set up modal close button
  setupModal();
  
  // Check authentication state
  onAuthStateChanged(auth, handleAuthStateChange);
});

// Handle authentication state changes
function handleAuthStateChange(user) {
  if (user) {
    console.log("User is logged in:", user.email);
    
    // Update UI based on user role
    if (loginLink) loginLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline";
    if (userAccountLink) userAccountLink.style.display = "inline";
    
    // Check if user is admin
    const isAdmin = user.uid === adminUID;
    
    if (isAdmin) {
      // Show admin dropdown and load users
      if (adminDropdownBtn) adminDropdownBtn.style.display = "inline";
      if (settingsIcon) settingsIcon.style.display = "flex";
      
      // Load users
      loadUsers();
    } else {
      // User is not admin, redirect to home page
      console.log("Non-admin user attempted to access user management");
      alert("You do not have permission to access this page");
      window.location.href = "index.html";
    }
  } else {
    // User is not logged in, redirect to login page
    console.log("User is not logged in, redirecting to login page");
    window.location.href = "login.html";
  }
}

// Set up dropdowns
function setupDropdowns() {
  // Admin dropdown
  if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      adminDropdownContent.classList.toggle("show-dropdown");
      this.classList.toggle("active");
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener("click", function(e) {
    if (!e.target.matches(".admin-dropdown-btn")) {
      const dropdowns = document.querySelectorAll(".admin-dropdown-content");
      dropdowns.forEach(dropdown => {
        if (dropdown.classList.contains("show-dropdown")) {
          dropdown.classList.remove("show-dropdown");
          
          // Also remove active class from buttons
          if (adminDropdownBtn) adminDropdownBtn.classList.remove("active");
        }
      });
    }
  });
}

// Set up logout
function setupLogout() {
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function() {
      signOut(auth).then(() => {
        console.log("User signed out");
        window.location.href = "index.html";
      }).catch(error => {
        console.error("Error signing out:", error);
      });
    });
  }
}

// Set up search functionality
function setupSearch() {
  if (userSearchInput) {
    userSearchInput.addEventListener("input", function() {
      const searchTerm = this.value.toLowerCase();
      const rows = usersTableBody.querySelectorAll("tr");
      
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? "" : "none";
      });
      
      // Update displayed count
      const visibleRows = usersTableBody.querySelectorAll("tr:not([style*='display: none'])").length;
      userCountElement.textContent = visibleRows;
    });
  }
}

// Set up modal
function setupModal() {
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", function() {
      userDetailModal.style.display = "none";
    });
  }
  
  // Close modal when clicking outside
  window.addEventListener("click", function(e) {
    if (e.target === userDetailModal) {
      userDetailModal.style.display = "none";
    }
  });
  
  // Set up form submission
  if (editUserForm) {
    editUserForm.addEventListener("submit", handleFormSubmit);
  }
  
  // Set up delete button
  if (deleteUserBtn) {
    deleteUserBtn.addEventListener("click", handleDeleteUser);
  }
}

async function loadUserComments(userId) {
  try {
    const commentsQuery = query(collection(db, "posts"), where("comments", "array-contains", userId));
    const querySnapshot = await getDocs(commentsQuery);
    let commentsHtml = '<div class="user-comments-section"><h3>User Comments</h3>';
    
    if (querySnapshot.empty) {
      commentsHtml += '<p>No comments found for this user.</p>';
    } else {
      commentsHtml += '<div class="comments-list">';
      let commentCount = 0;
      
      querySnapshot.forEach((doc) => {
        const postData = doc.data();
        if (postData.comments) {
          postData.comments.forEach(comment => {
            if (comment.userId === userId) {
              commentCount++;
              
              // Format the date
              let commentDate = "Unknown date";
              if (comment.createdAt) {
                if (typeof comment.createdAt.toDate === "function") {
                  commentDate = comment.createdAt.toDate().toLocaleString();
                } else if (comment.createdAt instanceof Date) {
                  commentDate = comment.createdAt.toLocaleString();
                } else if (typeof comment.createdAt === "string") {
                  commentDate = new Date(comment.createdAt).toLocaleString();
                }
              }
              
              commentsHtml += `
                <div class="comment-item">
                  <p><strong>Post:</strong> <a href="post.html?id=${doc.id}" target="_blank">${postData.title || "Untitled Post"}</a></p>
                  <p><strong>Comment:</strong> ${comment.text}</p>
                  <p><strong>Date:</strong> ${commentDate}</p>
                  ${comment.likes ? `<p><strong>Likes:</strong> ${comment.likes}</p>` : ""}
                  <div class="comment-actions" style="margin-top: 8px; text-align: right;">
                    <button class="delete-comment-btn" onclick="window.deleteComment('${doc.id}', '${comment.id}')" style="padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete Comment</button>
                  </div>
                </div>
              `;
            }
          });
        }
      });
      
      commentsHtml += "</div>";
      commentsHtml = commentsHtml.replace("<h3>User Comments</h3>", `<h3>User Comments (${commentCount})</h3>`);
    }
    
    commentsHtml += "</div>";
    return commentsHtml;
  } catch (error) {
    console.error("Error loading comments:", error);
    return "<p>Error loading comments.</p>";
  }
}

async function loadUsers() {
  try {
    console.log("Starting to load users...");
    // Fetch user data from the Cloud Function with appropriate headers
    const response = await fetch("https://us-central1-makeupbyny-1.cloudfunctions.net/listAllAuthUsers", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      credentials: "include"
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
      userList.innerHTML = "<li class='user-item'>No users found.</li>";
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
          <strong>Status:</strong> ${user.disabled ? "Disabled" : "Active"} |
          <strong>Role:</strong> <span class="user-role ${userData.isAdmin ? "admin-role" : "user-role"}" style="display: none;">${userData.isAdmin ? "Admin" : "User"}</span>
        </div>
        <div class="user-actions">
          <button class="view-details-btn" data-uid="${user.uid}">View Details</button>
          <button class="role-btn ${userData.isAdmin ? "remove-admin" : "make-admin"}" onclick="window.updateUserRole('${user.uid}', ${!userData.isAdmin})">${userData.isAdmin ? "Remove Admin" : "Make Admin"}</button>
          <button class="delete-btn" onclick="window.deleteUser('${user.uid}')">Delete</button>
        </div>
      `;
      userList.appendChild(li);
      
      // Add event listener directly to the button (avoids inline attributes with complex JSON)
      const viewDetailsBtn = li.querySelector(".view-details-btn");
      viewDetailsBtn.addEventListener("click", function() {
        window.showUserDetails(user.uid, { ...user, isAdmin: userData.isAdmin });
      });
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    userList.innerHTML = "<li class='user-item'>Error loading users.</li>";
  }
}

// Make functions available globally for onclick handlers
window.showUserDetails = async function(userId, userData = null) {
  currentUserId = userId;
  
  try {
    // Always fetch the latest user data from Firestore
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userFullData = userDoc.data();
      const commentsHtml = await loadUserComments(userId);
      
      // Get auth user data for email and status
      let authUserData = { email: "Unknown", disabled: false };
      if (userData && userData.email) {
        authUserData = userData;
      } else {
        // If userData wasn't provided or was invalid, try to get it from the user list
        const userItems = document.querySelectorAll(".user-item");
        userItems.forEach(item => {
          if (item.innerHTML.includes(userId)) {
            // Extract email from the user item
            const emailMatch = item.innerHTML.match(/Email:<\/strong> ([^<|]+)/);
            if (emailMatch && emailMatch[1]) {
              authUserData.email = emailMatch[1].trim();
            }
            
            // Extract status from the user item
            authUserData.disabled = item.innerHTML.includes("Status:</strong> Disabled");
          }
        });
      }
      
      // Format timestamps
      let createdAtDisplay = "Unknown";
      if (userFullData.createdAt) {
        createdAtDisplay = new Date(userFullData.createdAt.toDate()).toLocaleString();
      }
      
      let termsAcceptedDateDisplay = "Not accepted";
      if (userFullData.termsAcceptedDate) {
        termsAcceptedDateDisplay = new Date(userFullData.termsAcceptedDate).toLocaleString();
      }
      
      modalContent.innerHTML = `
        <div class="user-details-container">
          <div class="user-basic-info">
            <h3>Basic Information</h3>
            <p><strong>Email:</strong> ${authUserData.email || "Not provided"}</p>
            <p><strong>UID:</strong> ${userId}</p>
            <p><strong>Status:</strong> ${authUserData.disabled ? "Disabled" : "Active"}</p>
            <p><strong>Role:</strong> <span class="user-role ${userFullData.isAdmin ? "admin-role" : "user-role"}" style="display: none;">${userFullData.isAdmin ? "Admin" : "User"}</span></p>
          </div>
          
          <div class="user-personal-info">
            <h3>Personal Information</h3>
            <p><strong>First Name:</strong> ${userFullData.firstName || "Not provided"}</p>
            <p><strong>Last Name:</strong> ${userFullData.lastName || "Not provided"}</p>
            <p><strong>Username:</strong> ${userFullData.username || "Not provided"}</p>
            <p><strong>Phone Number:</strong> ${userFullData.phoneNumber || "Not provided"}</p>
          </div>
          
          <div class="user-account-info">
            <h3>Account Information</h3>
            <p><strong>Account Created:</strong> ${createdAtDisplay}</p>
            <p><strong>Terms & Policy Accepted:</strong> ${userFullData.termsAccepted ? "Yes" : "No"}</p>
            <p><strong>Acceptance Date:</strong> ${termsAcceptedDateDisplay}</p>
          </div>
          
          <div class="user-actions" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
            <h3>User Management</h3>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button class="role-btn ${userFullData.isAdmin ? "remove-admin" : "make-admin"}" onclick="window.updateUserRole('${userId}', ${!userFullData.isAdmin})">
                ${userFullData.isAdmin ? "Remove Admin" : "Make Admin"}
              </button>
              <button class="delete-btn" onclick="window.deleteUser('${userId}')">Delete User</button>
            </div>
          </div>
          
          ${commentsHtml}
        </div>
      `;
      modal.style.display = "block";
    } else {
      alert("User details not found");
    }
  } catch (error) {
    console.error("Error loading user details:", error);
    alert("Error loading user details: " + error.message);
  }
};

window.updateUserRole = async function(userId, isAdmin) {
  try {
    // First update the UI to provide immediate feedback
    // Find the list item containing this user by iterating through all user items
    const userItems = document.querySelectorAll(".user-item");
    let userItem = null;
    userItems.forEach(item => {
      if (item.innerHTML.includes(userId)) {
        userItem = item;
      }
    });
    
    if (userItem) {
      const roleSpan = userItem.querySelector(".user-role");
      const roleButton = userItem.querySelector(".role-btn");
      
      if (roleSpan) {
        roleSpan.textContent = isAdmin ? "Admin" : "User";
        roleSpan.className = `user-role ${isAdmin ? "admin-role" : "user-role"}`;
        roleSpan.style.display = "inline";
      }
      
      if (roleButton) {
        roleButton.textContent = isAdmin ? "Remove Admin" : "Make Admin";
        roleButton.className = `role-btn ${isAdmin ? "remove-admin" : "make-admin"}`;
      }
    }
    
    // Update in Firestore
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { isAdmin });
    
    // Show success message
    const message = document.createElement("div");
    message.className = "success-message";
    message.textContent = `User ${isAdmin ? "promoted to admin" : "removed from admin role"} successfully`;
    message.style.position = "fixed";
    message.style.top = "20px";
    message.style.left = "50%";
    message.style.transform = "translateX(-50%)";
    message.style.backgroundColor = "#4CAF50";
    message.style.color = "white";
    message.style.padding = "10px 20px";
    message.style.borderRadius = "5px";
    message.style.zIndex = "1000";
    document.body.appendChild(message);
    
    // Remove the message after 3 seconds
    setTimeout(() => {
      document.body.removeChild(message);
    }, 3000);
    
    // If a modal is currently displayed, update it too
    if (currentUserId === userId && modal.style.display === "block") {
      const modalRoleText = Array.from(modalContent.querySelectorAll("p")).find(p => p.textContent.includes("Role"));
      if (modalRoleText) {
        modalRoleText.innerHTML = `<strong>Role:</strong> ${isAdmin ? "Admin" : "User"}`;
      }
      
      const modalRoleButton = Array.from(modalContent.querySelectorAll("button")).find(btn => 
        btn.textContent.includes("Admin"));
      if (modalRoleButton) {
        modalRoleButton.textContent = isAdmin ? "Remove Admin" : "Make Admin";
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
        method: "DELETE"
      });
      
      if (response.ok) {
        alert("User deleted successfully");
        await loadUsers(); // Reload the list
      } else {
        throw new Error("Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Error deleting user");
    }
  }
};

// Add function to delete comments
window.deleteComment = async function(postId, commentId) {
  if (!confirm("Are you sure you want to delete this comment?")) return;
  
  try {
    // Get the post document
    const postRef = doc(db, "posts", postId);
    const postDoc = await getDoc(postRef);
    
    if (postDoc.exists()) {
      const postData = postDoc.data();
      
      // Filter out the comment to be deleted
      const updatedComments = postData.comments.filter(comment => comment.id !== commentId);
      
      // Update the post document with the filtered comments
      await updateDoc(postRef, { comments: updatedComments });
      
      alert("Comment deleted successfully");
      
      // Refresh the current user details modal
      if (currentUserId) {
        window.showUserDetails(currentUserId, { uid: currentUserId });
      }
    }
  } catch (error) {
    console.error("Error deleting comment:", error);
    alert("Error deleting comment: " + error.message);
  }
};

// Handle form submission
function handleFormSubmit(event) {
  event.preventDefault();
  // Handle form submission logic here
}

// Handle delete user
function handleDeleteUser(event) {
  event.preventDefault();
  // Handle delete user logic here
} 
// Import auth and db from firebase-config.js
import { auth, db, isSuperAdmin, updateSuperAdmins } from "./firebase-config.js";
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
let adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";
const adminDropdownBtn = document.getElementById("adminDropdownBtn");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const userAccountLink = document.getElementById("userAccountLink");
const settingsIcon = document.getElementById("settingsIcon");

// Initially hide account link and settings icon
if (userAccountLink) userAccountLink.style.display = "none";
if (settingsIcon) settingsIcon.style.display = "none";

// Initialize admin UID
async function initializeAdminUID() {
  adminUID = await getAdminUID();
}

// Call initialize function
initializeAdminUID();

// Check authentication and admin status
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state changed. Current user:", user ? user.uid : "No user");
  if (!user) {
    console.log("No user logged in, redirecting to login page");
    window.location.href = "login.html";
    return;
  }

  // Check if user is a super admin
  const superAdminStatus = await isSuperAdmin(user);
  if (!superAdminStatus) {
    console.log("User is not a super admin, redirecting to home page");
    content.innerHTML = '<div class="error-message">Access denied. Super Admin privileges required.</div>';
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
    return;
  }

  // Set display state for auth UI elements
  if (loginLink) loginLink.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline";
  if (adminDropdownBtn) adminDropdownBtn.style.display = "inline";
  if (userAccountLink) userAccountLink.style.display = "inline";
  if (settingsIcon) settingsIcon.style.display = "flex";

  console.log("User is super admin, loading users...");
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
              let commentDate = 'Unknown date';
              if (comment.createdAt) {
                if (typeof comment.createdAt.toDate === 'function') {
                  commentDate = comment.createdAt.toDate().toLocaleString();
                } else if (comment.createdAt instanceof Date) {
                  commentDate = comment.createdAt.toLocaleString();
                } else if (typeof comment.createdAt === 'string') {
                  commentDate = new Date(comment.createdAt).toLocaleString();
                }
              }
              
              commentsHtml += `
                <div class="comment-item">
                  <p><strong>Post:</strong> <a href="post.html?id=${doc.id}" target="_blank">${postData.title || 'Untitled Post'}</a></p>
                  <p><strong>Comment:</strong> ${comment.text}</p>
                  <p><strong>Date:</strong> ${commentDate}</p>
                  ${comment.likes ? `<p><strong>Likes:</strong> ${comment.likes}</p>` : ''}
                  <div class="comment-actions" style="margin-top: 8px; text-align: right;">
                    <button class="delete-comment-btn" onclick="window.deleteComment('${doc.id}', '${comment.id}')" style="padding: 4px 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">Delete Comment</button>
                  </div>
                </div>
              `;
            }
          });
        }
      });
      
      commentsHtml += '</div>';
      commentsHtml = commentsHtml.replace('<h3>User Comments</h3>', `<h3>User Comments (${commentCount})</h3>`);
    }
    
    commentsHtml += '</div>';
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

    // Get the list of super admins
    const configRef = doc(db, "config", "admin");
    const configDoc = await getDoc(configRef);
    const superAdmins = configDoc.exists() ? (configDoc.data().superAdmins || []) : [];

    // Loop through each user and create an HTML list item
    users.forEach(async user => {
      console.log("Processing user:", user.email);
      
      // Get user's admin status from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : { isAdmin: false };
      
      // Check if the user is a super admin
      const isSuperAdminUser = superAdmins.includes(user.uid);
      
      const li = document.createElement("li");
      li.className = "user-item";
      li.innerHTML = `
        <div class="user-info">
          <strong>Email:</strong> ${user.email} | 
          <strong>UID:</strong> ${user.uid} | 
          <strong>Status:</strong> ${user.disabled ? 'Disabled' : 'Active'} |
          <strong>Role:</strong> <span class="user-role ${userData.isAdmin ? 'admin-role' : 'user-role'}">${userData.isAdmin ? (isSuperAdminUser ? 'Super Admin' : 'Admin') : 'User'}</span>
        </div>
        <div class="user-actions">
          <button class="view-details-btn" data-uid="${user.uid}">View Details</button>
          <button class="role-btn ${userData.isAdmin ? 'remove-admin' : 'make-admin'}" onclick="window.updateUserRole('${user.uid}', ${!userData.isAdmin})">${userData.isAdmin ? 'Remove Admin' : 'Make Admin'}</button>
          <button class="super-admin-btn ${isSuperAdminUser ? 'remove-super-admin' : 'make-super-admin'}" onclick="window.updateSuperAdminRole('${user.uid}', ${!isSuperAdminUser})">${isSuperAdminUser ? 'Remove Super Admin' : 'Make Super Admin'}</button>
          <button class="delete-btn" onclick="window.deleteUser('${user.uid}')">Delete</button>
        </div>
      `;
      userList.appendChild(li);
      
      // Add event listener directly to the button (avoids inline attributes with complex JSON)
      const viewDetailsBtn = li.querySelector('.view-details-btn');
      viewDetailsBtn.addEventListener('click', function() {
        window.showUserDetails(user.uid, {...user, isAdmin: userData.isAdmin, isSuperAdmin: isSuperAdminUser});
      });
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    userList.innerHTML = '<li class="user-item">Error loading users.</li>';
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
        const userItems = document.querySelectorAll('.user-item');
        userItems.forEach(item => {
          if (item.innerHTML.includes(userId)) {
            // Extract email from the user item
            const emailMatch = item.innerHTML.match(/Email:<\/strong> ([^<|]+)/);
            if (emailMatch && emailMatch[1]) {
              authUserData.email = emailMatch[1].trim();
            }
            
            // Extract status from the user item
            authUserData.disabled = item.innerHTML.includes('Status:</strong> Disabled');
          }
        });
      }
      
      // Format timestamps
      let createdAtDisplay = 'Unknown';
      if (userFullData.createdAt) {
        createdAtDisplay = new Date(userFullData.createdAt.toDate()).toLocaleString();
      }
      
      let termsAcceptedDateDisplay = 'Not accepted';
      if (userFullData.termsAcceptedDate) {
        termsAcceptedDateDisplay = new Date(userFullData.termsAcceptedDate).toLocaleString();
      }
      
      modalContent.innerHTML = `
        <div class="user-details-container">
          <div class="user-basic-info">
            <h3>Basic Information</h3>
            <p><strong>Email:</strong> ${authUserData.email || 'Not provided'}</p>
            <p><strong>UID:</strong> ${userId}</p>
            <p><strong>Status:</strong> ${authUserData.disabled ? 'Disabled' : 'Active'}</p>
            <p><strong>Role:</strong> <span class="user-role ${userFullData.isAdmin ? 'admin-role' : 'user-role'}">${userFullData.isAdmin ? 'Admin' : 'User'}</span></p>
          </div>
          
          <div class="user-personal-info">
            <h3>Personal Information</h3>
            <p><strong>First Name:</strong> ${userFullData.firstName || 'Not provided'}</p>
            <p><strong>Last Name:</strong> ${userFullData.lastName || 'Not provided'}</p>
            <p><strong>Username:</strong> ${userFullData.username || 'Not provided'}</p>
            <p><strong>Phone Number:</strong> ${userFullData.phoneNumber || 'Not provided'}</p>
          </div>
          
          <div class="user-account-info">
            <h3>Account Information</h3>
            <p><strong>Account Created:</strong> ${createdAtDisplay}</p>
            <p><strong>Terms & Policy Accepted:</strong> ${userFullData.termsAccepted ? 'Yes' : 'No'}</p>
            <p><strong>Acceptance Date:</strong> ${termsAcceptedDateDisplay}</p>
          </div>
          
          <div class="user-actions" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
            <h3>User Management</h3>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button class="role-btn ${userFullData.isAdmin ? 'remove-admin' : 'make-admin'}" onclick="window.updateUserRole('${userId}', ${!userFullData.isAdmin})">
                ${userFullData.isAdmin ? 'Remove Admin' : 'Make Admin'}
              </button>
              <button class="delete-btn" onclick="window.deleteUser('${userId}')">Delete User</button>
            </div>
          </div>
          
          ${commentsHtml}
        </div>
      `;
      modal.style.display = "block";
    } else {
      alert('User details not found');
    }
  } catch (error) {
    console.error('Error loading user details:', error);
    alert('Error loading user details: ' + error.message);
  }
};

// Update the updateUserRole function to handle regular admin role changes
window.updateUserRole = async function(userId, makeAdmin) {
  try {
    // Update the isAdmin field in the user document
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      isAdmin: makeAdmin
    });

    // Reload users to reflect changes
    await loadUsers();
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

// Add function to delete comments
window.deleteComment = async function(postId, commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  
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
      
      alert('Comment deleted successfully');
      
      // Refresh the current user details modal
      if (currentUserId) {
        window.showUserDetails(currentUserId, { uid: currentUserId });
      }
    }
  } catch (error) {
    console.error('Error deleting comment:', error);
    alert('Error deleting comment: ' + error.message);
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

// Add function to update super admin role
window.updateSuperAdminRole = async function(userId, makeSuperAdmin) {
  try {
    // Update the super admin list
    await updateSuperAdmins(userId, makeSuperAdmin);
    
    // Reload users to reflect changes
    await loadUsers();
  } catch (error) {
    console.error("Error updating super admin role:", error);
    alert("Error updating super admin role: " + error.message);
  }
}; 
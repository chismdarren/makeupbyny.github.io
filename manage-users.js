// Import auth and db from firebase-config.js
import { auth, db, superAdminUIDs, isSuperAdmin } from "./firebase-config.js";
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

// Synchronize superAdminUIDs with Firestore
async function syncSuperAdmins() {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("isSuperAdmin", "==", true));
    const querySnapshot = await getDocs(q);
    
    // Get all super admin UIDs from Firestore
    const firestoreSuperAdmins = [];
    querySnapshot.forEach((doc) => {
      firestoreSuperAdmins.push(doc.id);
    });
    
    console.log("Firestore super admins:", firestoreSuperAdmins);
    
    // Add any new super admins to the array
    firestoreSuperAdmins.forEach(uid => {
      if (!superAdminUIDs.includes(uid)) {
        superAdminUIDs.push(uid);
      }
    });
    
    console.log("Synchronized super admin list:", superAdminUIDs);
  } catch (error) {
    console.error("Error syncing super admins:", error);
  }
}

// DOM elements
const userList = document.getElementById("user-list");
const modal = document.getElementById("userModal");
const modalContent = document.getElementById("modalContent");
const closeBtn = document.getElementsByClassName("close")[0];
const content = document.getElementById("content");
let currentUserId = null;

// Admin UID and UI elements
const adminDropdownBtn = document.getElementById("adminDropdownBtn");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const userAccountLink = document.getElementById("userAccountLink");
const settingsIcon = document.getElementById("settingsIcon");

// Initially hide account link and settings icon
if (userAccountLink) userAccountLink.style.display = "none";
if (settingsIcon) settingsIcon.style.display = "none";

// Check authentication and admin status
onAuthStateChanged(auth, async (user) => {
  console.log("Auth state changed. Current user:", user ? user.uid : "No user");
  if (!user) {
    console.log("No user logged in, redirecting to login page");
    window.location.href = "login.html";
    return;
  }

  // Sync super admins with Firestore first
  await syncSuperAdmins();

  const isUserSuperAdmin = await isSuperAdmin(user.uid);
  if (!isUserSuperAdmin) {
    console.log("User is not super admin, redirecting to home page");
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

    // Loop through each user and create an HTML list item
    users.forEach(async user => {
      console.log("Processing user:", user.email);
      
      // Get user's admin status from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.exists() ? userDoc.data() : { isAdmin: false, isSuperAdmin: false };
      
      // Get user role display
      let roleDisplay = 'User';
      let roleClass = 'user-role';
      if (userData.isSuperAdmin) {
        roleDisplay = 'Super Admin';
        roleClass = 'super-admin-role';
      } else if (userData.isAdmin) {
        roleDisplay = 'Admin';
        roleClass = 'admin-role';
      }
      
      const li = document.createElement("li");
      li.className = "user-item";
      li.innerHTML = `
        <div class="user-info">
          <strong>Email:</strong> ${user.email} | 
          <strong>UID:</strong> ${user.uid} | 
          <strong>Status:</strong> ${user.disabled ? 'Disabled' : 'Active'} |
          <strong>Role:</strong> <span class="user-role ${roleClass}">${roleDisplay}</span>
        </div>
        <div class="user-actions">
          <button class="view-details-btn" data-uid="${user.uid}">View Details</button>
          ${userData.isSuperAdmin ? 
            `<button class="role-btn remove-super-admin" onclick="window.updateSuperAdminRole('${user.uid}', false)">Remove Super Admin</button>` :
            userData.isAdmin ? 
              `<button class="role-btn make-super-admin" onclick="window.updateSuperAdminRole('${user.uid}', true)">Make Super Admin</button>
               <button class="role-btn remove-admin" onclick="window.updateUserRole('${user.uid}', false)">Remove Admin</button>` :
              `<button class="role-btn make-admin" onclick="window.updateUserRole('${user.uid}', true)">Make Admin</button>`
          }
          <button class="delete-btn" onclick="window.deleteUser('${user.uid}')">Delete</button>
        </div>
      `;
      userList.appendChild(li);
      
      // Add event listener directly to the button (avoids inline attributes with complex JSON)
      const viewDetailsBtn = li.querySelector('.view-details-btn');
      viewDetailsBtn.addEventListener('click', function() {
        window.showUserDetails(user.uid, {...user, isAdmin: userData.isAdmin, isSuperAdmin: userData.isSuperAdmin});
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
    console.log("Showing details for user:", userId);
    
    // Always fetch the latest user data from Firestore
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      console.log("User document exists in Firestore");
      const userFullData = userDoc.data();
      console.log("User data:", userFullData);
      
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
      
      // Format timestamps with proper null checks
      let createdAtDisplay = 'Unknown';
      if (userFullData.createdAt) {
        try {
          createdAtDisplay = userFullData.createdAt.toDate ? 
            new Date(userFullData.createdAt.toDate()).toLocaleString() : 
            new Date(userFullData.createdAt).toLocaleString();
        } catch (e) {
          console.error("Error formatting createdAt:", e);
          createdAtDisplay = 'Invalid date format';
        }
      }
      
      let termsAcceptedDateDisplay = 'Not accepted';
      if (userFullData.termsAcceptedDate) {
        try {
          termsAcceptedDateDisplay = userFullData.termsAcceptedDate.toDate ? 
            new Date(userFullData.termsAcceptedDate.toDate()).toLocaleString() : 
            new Date(userFullData.termsAcceptedDate).toLocaleString();
        } catch (e) {
          console.error("Error formatting termsAcceptedDate:", e);
          termsAcceptedDateDisplay = 'Invalid date format';
        }
      }
      
      // Get user role display
      let roleDisplay = 'User';
      let roleClass = 'user-role';
      if (userFullData.isSuperAdmin) {
        roleDisplay = 'Super Admin';
        roleClass = 'super-admin-role';
      } else if (userFullData.isAdmin) {
        roleDisplay = 'Admin';
        roleClass = 'admin-role';
      }
      
      modalContent.innerHTML = `
        <div class="user-details-container">
          <div class="user-basic-info">
            <h3>Basic Information</h3>
            <p><strong>Email:</strong> ${authUserData.email || 'Not provided'}</p>
            <p><strong>UID:</strong> ${userId}</p>
            <p><strong>Status:</strong> ${authUserData.disabled ? 'Disabled' : 'Active'}</p>
            <p><strong>Role:</strong> <span class="user-role ${roleClass}">${roleDisplay}</span></p>
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
              ${userFullData.isSuperAdmin ? 
                `<button class="role-btn remove-super-admin" onclick="window.updateSuperAdminRole('${userId}', false)">Remove Super Admin</button>` :
                userFullData.isAdmin ? 
                  `<button class="role-btn make-super-admin" onclick="window.updateSuperAdminRole('${userId}', true)">Make Super Admin</button>
                   <button class="role-btn remove-admin" onclick="window.updateUserRole('${userId}', false)">Remove Admin</button>` :
                  `<button class="role-btn make-admin" onclick="window.updateUserRole('${userId}', true)">Make Admin</button>`
              }
              <button class="delete-btn" onclick="window.deleteUser('${userId}')">Delete User</button>
            </div>
          </div>
          
          ${commentsHtml}
        </div>
      `;
      modal.style.display = "block";
    } else {
      console.error(`User document for ID ${userId} not found in Firestore`);
      
      // If we don't have Firestore data but have auth data, show a simplified view
      if (userData && userData.email) {
        modalContent.innerHTML = `
          <div class="user-details-container">
            <div class="user-basic-info">
              <h3>Basic Information</h3>
              <p><strong>Email:</strong> ${userData.email || 'Not provided'}</p>
              <p><strong>UID:</strong> ${userId}</p>
              <p><strong>Status:</strong> ${userData.disabled ? 'Disabled' : 'Active'}</p>
              <p><strong>Role:</strong> <span class="user-role">User</span></p>
              <p style="color: #e74c3c; margin-top: 20px;"><strong>Note:</strong> This user account exists in Firebase Authentication but has no Firestore document. Some user data may be incomplete.</p>
            </div>
            
            <div class="user-actions" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;">
              <h3>User Management</h3>
              <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button class="role-btn make-admin" onclick="window.updateUserRole('${userId}', true)">Make Admin</button>
                <button class="delete-btn" onclick="window.deleteUser('${userId}')">Delete User</button>
              </div>
            </div>
          </div>
        `;
        modal.style.display = "block";
      } else {
        alert('User details not found in Firestore or Authentication');
      }
    }
  } catch (error) {
    console.error('Error loading user details:', error);
    alert('Error loading user details: ' + error.message);
  }
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
      const userActions = userItem.querySelector('.user-actions');
      
      if (roleSpan) {
        roleSpan.textContent = isAdmin ? 'Admin' : 'User';
        roleSpan.className = `user-role ${isAdmin ? 'admin-role' : 'user-role'}`;
      }
      
      // Update action buttons
      if (userActions) {
        const actionButtons = Array.from(userActions.querySelectorAll('button')).filter(btn => btn.textContent.includes('Admin'));
        actionButtons.forEach(btn => userActions.removeChild(btn));
        
        // Insert new buttons after view details button
        const viewDetailsBtn = userActions.querySelector('.view-details-btn');
        if (viewDetailsBtn) {
          if (isAdmin) {
            const makeSuperAdminBtn = document.createElement('button');
            makeSuperAdminBtn.className = 'role-btn make-super-admin';
            makeSuperAdminBtn.onclick = () => window.updateSuperAdminRole(userId, true);
            makeSuperAdminBtn.textContent = 'Make Super Admin';
            
            const removeAdminBtn = document.createElement('button');
            removeAdminBtn.className = 'role-btn remove-admin';
            removeAdminBtn.onclick = () => window.updateUserRole(userId, false);
            removeAdminBtn.textContent = 'Remove Admin';
            
            userActions.insertBefore(removeAdminBtn, viewDetailsBtn.nextSibling);
            userActions.insertBefore(makeSuperAdminBtn, viewDetailsBtn.nextSibling);
          } else {
            const makeAdminBtn = document.createElement('button');
            makeAdminBtn.className = 'role-btn make-admin';
            makeAdminBtn.onclick = () => window.updateUserRole(userId, true);
            makeAdminBtn.textContent = 'Make Admin';
            
            userActions.insertBefore(makeAdminBtn, viewDetailsBtn.nextSibling);
          }
        }
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
      window.showUserDetails(userId, { uid: userId, isAdmin: isAdmin, isSuperAdmin: false });
    }
  } catch (error) {
    console.error("Error updating user role:", error);
    alert("Error updating user role: " + error.message);
  }
};

// Add the Super Admin role update function
window.updateSuperAdminRole = async function(userId, makeUserSuperAdmin) {
  try {
    // Get current authenticated user
    const user = auth.currentUser;
    const isCurrentUserSuperAdmin = await isSuperAdmin(user.uid);
    if (!user || !isCurrentUserSuperAdmin) {
      alert("You need super admin privileges to manage super admins");
      return;
    }
    
    // Prevent removing the last super admin
    if (!makeUserSuperAdmin && userId === user.uid) {
      const superAdmins = [...superAdminUIDs];
      
      // Also check Firestore for other super admins
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("isSuperAdmin", "==", true));
      const superAdminDocs = await getDocs(q);
      const superAdminCount = superAdminDocs.size;
      
      if (superAdminCount <= 1) {
        alert("Cannot remove the last super admin. Promote another user to super admin first.");
        return;
      }
    }
    
    // First update the UI to provide immediate feedback
    const userItems = document.querySelectorAll('.user-item');
    let userItem = null;
    userItems.forEach(item => {
      if (item.innerHTML.includes(userId)) {
        userItem = item;
      }
    });
    
    if (userItem) {
      const roleSpan = userItem.querySelector('.user-role');
      const userActions = userItem.querySelector('.user-actions');
      
      if (roleSpan) {
        roleSpan.textContent = makeUserSuperAdmin ? 'Super Admin' : 'Admin';
        roleSpan.className = `user-role ${makeUserSuperAdmin ? 'super-admin-role' : 'admin-role'}`;
      }
      
      // Update action buttons
      if (userActions) {
        const actionButtons = Array.from(userActions.querySelectorAll('button')).filter(btn => btn.textContent.includes('Admin'));
        actionButtons.forEach(btn => userActions.removeChild(btn));
        
        // Insert new buttons after view details button
        const viewDetailsBtn = userActions.querySelector('.view-details-btn');
        if (viewDetailsBtn) {
          if (makeUserSuperAdmin) {
            const removeSuperAdminBtn = document.createElement('button');
            removeSuperAdminBtn.className = 'role-btn remove-super-admin';
            removeSuperAdminBtn.onclick = () => window.updateSuperAdminRole(userId, false);
            removeSuperAdminBtn.textContent = 'Remove Super Admin';
            
            userActions.insertBefore(removeSuperAdminBtn, viewDetailsBtn.nextSibling);
          } else {
            const makeSuperAdminBtn = document.createElement('button');
            makeSuperAdminBtn.className = 'role-btn make-super-admin';
            makeSuperAdminBtn.onclick = () => window.updateSuperAdminRole(userId, true);
            makeSuperAdminBtn.textContent = 'Make Super Admin';
            
            const removeAdminBtn = document.createElement('button');
            removeAdminBtn.className = 'role-btn remove-admin';
            removeAdminBtn.onclick = () => window.updateUserRole(userId, false);
            removeAdminBtn.textContent = 'Remove Admin';
            
            userActions.insertBefore(removeAdminBtn, viewDetailsBtn.nextSibling);
            userActions.insertBefore(makeSuperAdminBtn, viewDetailsBtn.nextSibling);
          }
        }
      }
    }
    
    // Update in Firestore
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, { 
      isSuperAdmin: makeUserSuperAdmin,
      isAdmin: true // Super admins are also admins
    });
    
    // Update superAdminUIDs array
    let updated = false;
    if (makeUserSuperAdmin && !superAdminUIDs.includes(userId)) {
      superAdminUIDs.push(userId);
      updated = true;
    } else if (!makeUserSuperAdmin && superAdminUIDs.includes(userId)) {
      const index = superAdminUIDs.indexOf(userId);
      if (index > -1) {
        superAdminUIDs.splice(index, 1);
        updated = true;
      }
    }
    
    if (updated) {
      console.log("Updated super admin list:", superAdminUIDs);
    }
    
    // Show success message
    const message = document.createElement('div');
    message.className = 'success-message';
    message.textContent = `User ${makeUserSuperAdmin ? 'promoted to super admin' : 'removed from super admin role'} successfully`;
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
      
      // After making a change to super admin status, refresh the page to update permissions
      if (makeUserSuperAdmin || userId === user.uid) {
        window.location.reload();
      }
    }, 3000);
    
    // If a modal is currently displayed, update it too
    if (currentUserId === userId && modal.style.display === "block") {
      window.showUserDetails(userId, { uid: userId, isAdmin: true, isSuperAdmin: makeUserSuperAdmin });
    }
  } catch (error) {
    console.error("Error updating super admin role:", error);
    alert("Error updating super admin role: " + error.message);
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
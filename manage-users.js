// Import auth and db from firebase-config.js
import { auth, db, superAdminUIDs, isSuperAdmin } from "./firebase-config.js";
import { onAuthStateChanged, signOut, getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where,
  getDoc,
  setDoc,
  serverTimestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Add styles for password management
const passwordManagementStyles = `
  .user-password-section {
    margin-top: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 5px;
    border: 1px solid #e9ecef;
  }
  
  .action-btn {
    padding: 8px 16px;
    background-color: #2196F3;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.3s;
  }
  
  .action-btn:hover {
    background-color: #0b7dda;
  }
  
  #password-reset-result {
    margin-top: 10px;
    line-height: 1.5;
  }
  
  #password-reset-result button {
    padding: 6px 12px;
    background-color: #f1f1f1;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
  }
  
  #password-reset-result button:hover {
    background-color: #e7e7e7;
  }
`;

// Add styles for filtering
const filterStyles = `
  .filter-section {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 5px;
    border: 1px solid #e9ecef;
  }
  
  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .filter-label {
    font-weight: bold;
    white-space: nowrap;
  }
  
  .filter-control {
    padding: 8px;
    border: 1px solid #ced4da;
    border-radius: 4px;
    min-width: 120px;
  }
  
  .reset-filters {
    padding: 8px 16px;
    background-color: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-left: auto;
  }
  
  .reset-filters:hover {
    background-color: #5a6268;
  }
  
  .user-count {
    margin-left: 10px;
    font-style: italic;
    color: #6c757d;
  }
`;

// Add the styles to the document head
document.addEventListener('DOMContentLoaded', () => {
  // Add the styles to the document head
  const styleElement = document.createElement('style');
  styleElement.textContent = passwordManagementStyles + filterStyles;
  document.head.appendChild(styleElement);
  
  console.log("Manage Users page loaded - styles initialized");
  
  // Initialize filters after page loads
  initializeFilters();
});

// Global variable to store all users for filtering
let allUsers = [];

// Initialize filter UI
function initializeFilters() {
  // Create filter container
  const filterContainer = document.createElement('div');
  filterContainer.className = 'filter-section';
  filterContainer.innerHTML = `
    <div class="filter-group">
      <span class="filter-label">Sort By:</span>
      <select id="sort-by" class="filter-control">
        <option value="email">Email</option>
        <option value="status">Status</option>
        <option value="role">Role</option>
        <option value="date">Date Created</option>
      </select>
    </div>
    <div class="filter-group">
      <span class="filter-label">Direction:</span>
      <select id="sort-direction" class="filter-control">
        <option value="asc">Ascending</option>
        <option value="desc">Descending</option>
      </select>
    </div>
    <div class="filter-group">
      <span class="filter-label">Status:</span>
      <select id="filter-status" class="filter-control">
        <option value="all">All</option>
        <option value="active">Active</option>
        <option value="disabled">Disabled</option>
      </select>
    </div>
    <div class="filter-group">
      <span class="filter-label">Role:</span>
      <select id="filter-role" class="filter-control">
        <option value="all">All</option>
        <option value="user">User</option>
        <option value="admin">Admin</option>
        <option value="superadmin">Super Admin</option>
      </select>
    </div>
    <div class="filter-group">
      <span class="filter-label">Search:</span>
      <input type="text" id="search-input" class="filter-control" placeholder="Email or name...">
    </div>
    <button id="reset-filters" class="reset-filters">Reset Filters</button>
    <span id="user-count" class="user-count"></span>
  `;
  
  // Insert filter container before the user list
  const userList = document.getElementById('user-list');
  if (userList) {
    userList.parentNode.insertBefore(filterContainer, userList);
  }
  
  // Add event listeners to filters
  document.getElementById('sort-by').addEventListener('change', applyFilters);
  document.getElementById('sort-direction').addEventListener('change', applyFilters);
  document.getElementById('filter-status').addEventListener('change', applyFilters);
  document.getElementById('filter-role').addEventListener('change', applyFilters);
  document.getElementById('search-input').addEventListener('input', applyFilters);
  document.getElementById('reset-filters').addEventListener('click', resetFilters);
}

// Reset filters to default values
function resetFilters() {
  document.getElementById('sort-by').value = 'email';
  document.getElementById('sort-direction').value = 'asc';
  document.getElementById('filter-status').value = 'all';
  document.getElementById('filter-role').value = 'all';
  document.getElementById('search-input').value = '';
  
  applyFilters();
}

// Apply filters and sort users
function applyFilters() {
  if (allUsers.length === 0) return;
  
  const sortBy = document.getElementById('sort-by').value;
  const sortDirection = document.getElementById('sort-direction').value;
  const filterStatus = document.getElementById('filter-status').value;
  const filterRole = document.getElementById('filter-role').value;
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  
  // Filter users
  let filteredUsers = [...allUsers];
  
  // Filter by status
  if (filterStatus !== 'all') {
    const isDisabled = filterStatus === 'disabled';
    filteredUsers = filteredUsers.filter(user => user.disabled === isDisabled);
  }
  
  // Filter by role
  if (filterRole !== 'all') {
    filteredUsers = filteredUsers.filter(user => {
      if (filterRole === 'superadmin') return user.userData.isSuperAdmin;
      if (filterRole === 'admin') return user.userData.isAdmin && !user.userData.isSuperAdmin;
      return !user.userData.isAdmin; // regular users
    });
  }
  
  // Filter by search term
  if (searchTerm) {
    filteredUsers = filteredUsers.filter(user => {
      const email = (user.email || '').toLowerCase();
      const firstName = (user.userData.firstName || '').toLowerCase();
      const lastName = (user.userData.lastName || '').toLowerCase();
      const username = (user.userData.username || '').toLowerCase();
      
      return email.includes(searchTerm) || 
             firstName.includes(searchTerm) || 
             lastName.includes(searchTerm) ||
             username.includes(searchTerm);
    });
  }
  
  // Sort users
  filteredUsers.sort((a, b) => {
    let valueA, valueB;
    
    switch (sortBy) {
      case 'email':
        valueA = (a.email || '').toLowerCase();
        valueB = (b.email || '').toLowerCase();
        break;
      case 'status':
        valueA = a.disabled ? 'disabled' : 'active';
        valueB = b.disabled ? 'disabled' : 'active';
        break;
      case 'role':
        valueA = a.userData.isSuperAdmin ? 3 : (a.userData.isAdmin ? 2 : 1);
        valueB = b.userData.isSuperAdmin ? 3 : (b.userData.isAdmin ? 2 : 1);
        break;
      case 'date':
        // Get timestamp values
        valueA = getTimestampValue(a.userData.createdAt) || 0;
        valueB = getTimestampValue(b.userData.createdAt) || 0;
        break;
      default:
        valueA = (a.email || '').toLowerCase();
        valueB = (b.email || '').toLowerCase();
    }
    
    // Sort direction
    let comparison = 0;
    if (valueA > valueB) {
      comparison = 1;
    } else if (valueA < valueB) {
      comparison = -1;
    }
    
    return sortDirection === 'desc' ? -comparison : comparison;
  });
  
  // Update user count
  const userCount = document.getElementById('user-count');
  if (userCount) {
    userCount.textContent = `Showing ${filteredUsers.length} of ${allUsers.length} users`;
  }
  
  // Display filtered users
  displayFilteredUsers(filteredUsers);
}

// Helper function to get timestamp value for sorting
function getTimestampValue(timestamp) {
  if (!timestamp) return 0;
  
  try {
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().getTime();
    } else if (timestamp instanceof Date) {
      return timestamp.getTime();
    } else if (typeof timestamp === 'string') {
      return new Date(timestamp).getTime();
    }
  } catch (e) {
    console.error("Error parsing timestamp:", e);
  }
  
  return 0;
}

// Display filtered users in the UI
function displayFilteredUsers(users) {
  const userList = document.getElementById('user-list');
  if (!userList) return;
  
  // Clear user list
  userList.innerHTML = '';
  
  if (users.length === 0) {
    userList.innerHTML = '<li class="user-item">No users found matching the current filters.</li>';
    return;
  }
  
  // Add each user to the list
  users.forEach(user => {
    userList.appendChild(user.element);
  });
}

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

    // Create a loading indicator
    const loadingItem = document.createElement("li");
    loadingItem.className = "user-item";
    loadingItem.innerHTML = `<div class="user-info">Loading user data...</div>`;
    userList.appendChild(loadingItem);

    // Track promises for all user data fetching
    const userDataPromises = [];

    // Loop through each user and create an HTML list item
    users.forEach(user => {
      // Add the promise to our array
      userDataPromises.push(
        (async () => {
          console.log("Processing user:", user.email);
          
          // Get user's data from Firestore
          const userRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userRef);
          
          let userData;
          if (userDoc.exists()) {
            userData = userDoc.data();
            console.log(`User document found for ${user.email}:`, userData);
          } else {
            // If no user document exists, just use the auth data - don't create a document
            console.log(`No Firestore document found for ${user.email}`);
            userData = {
              email: user.email,
              isAdmin: false,
              isSuperAdmin: false
            };
          }
          
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
          li.setAttribute('data-uid', user.uid);
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
          
          return { 
            element: li, 
            userData: {...userData}, 
            ...user, // Spread auth data like email, disabled
            uid: user.uid 
          };
        })()
      );
    });

    // Wait for all users to be processed
    const userResults = await Promise.all(userDataPromises);
    
    // Remove loading indicator
    userList.innerHTML = "";
    
    // Store the user results for filtering
    allUsers = userResults;
    
    // Apply initial filters
    applyFilters();
    
    // Append all user elements and add event listeners
    userResults.forEach(result => {
      // Add event listener directly to the button
      const viewDetailsBtn = result.element.querySelector('.view-details-btn');
      viewDetailsBtn.addEventListener('click', function() {
        window.showUserDetails(result.uid, result);
      });
    });
    
    console.log("All users loaded successfully");
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
    
    // Setup default auth user data and user profile data
    let userFullData = {};
    let authUserData = { email: "Unknown", disabled: false };
    
    // Use provided userData if available
    if (userData && userData.email) {
      authUserData = userData;
      console.log("Using provided auth user data:", authUserData);
    }
    
    if (userDoc.exists()) {
      userFullData = userDoc.data();
      console.log("User document found in Firestore:", userFullData);
    } else {
      console.log("No Firestore document exists for user:", userId);
      // Don't create a document - just display what we know from auth data
      userFullData = {
        email: authUserData.email,
        isAdmin: false,
        isSuperAdmin: false
      };
    }
    
    // If authUserData email is Unknown, try to extract from DOM
    if (authUserData.email === "Unknown") {
      const userItem = document.querySelector(`li[data-uid="${userId}"]`);
      if (userItem) {
        const emailMatch = userItem.innerHTML.match(/Email:<\/strong> ([^<|]+)/);
        if (emailMatch && emailMatch[1]) {
          authUserData.email = emailMatch[1].trim();
          if (!userFullData.email) {
            userFullData.email = authUserData.email;
          }
        }
        
        authUserData.disabled = userItem.innerHTML.includes('Status:</strong> Disabled');
      }
    }
    
    const commentsHtml = await loadUserComments(userId);
    
    // Format timestamps with robust handling
    let createdAtDisplay = 'Unknown';
    if (userFullData.createdAt) {
      try {
        if (typeof userFullData.createdAt.toDate === 'function') {
          createdAtDisplay = new Date(userFullData.createdAt.toDate()).toLocaleString();
        } else if (userFullData.createdAt instanceof Date) {
          createdAtDisplay = userFullData.createdAt.toLocaleString();
        } else if (typeof userFullData.createdAt === 'string') {
          createdAtDisplay = new Date(userFullData.createdAt).toLocaleString();
        }
      } catch (e) {
        console.error("Error formatting createdAt timestamp:", e);
      }
    }
    
    let termsAcceptedDateDisplay = 'Not accepted';
    if (userFullData.termsAcceptedDate) {
      try {
        if (typeof userFullData.termsAcceptedDate === 'string') {
          termsAcceptedDateDisplay = new Date(userFullData.termsAcceptedDate).toLocaleString();
        } else if (typeof userFullData.termsAcceptedDate.toDate === 'function') {
          termsAcceptedDateDisplay = new Date(userFullData.termsAcceptedDate.toDate()).toLocaleString();
        } else if (userFullData.termsAcceptedDate instanceof Date) {
          termsAcceptedDateDisplay = userFullData.termsAcceptedDate.toLocaleString();
        }
      } catch (e) {
        console.error("Error formatting termsAcceptedDate timestamp:", e);
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
    
    // Check if data appears to be missing
    const hasMissingData = !userFullData.firstName || !userFullData.lastName || !userFullData.username || !userFullData.phoneNumber;
    const userSignupComplete = userFullData.firstName && userFullData.lastName && userFullData.username && userFullData.phoneNumber;
    
    modalContent.innerHTML = `
      <div class="user-details-container">
        <div class="user-basic-info">
          <h3>Basic Information</h3>
          <p><strong>Email:</strong> ${authUserData.email || userFullData.email || 'Not provided'}</p>
          <p><strong>UID:</strong> ${userId}</p>
          <p><strong>Status:</strong> ${authUserData.disabled ? 'Disabled' : 'Active'}</p>
          <p><strong>Role:</strong> <span class="user-role ${roleClass}">${roleDisplay}</span></p>
        </div>
        
        <div class="user-personal-info">
          <h3>Personal Information</h3>
          ${!userSignupComplete ? '<p class="warning-message">⚠️ User signup data is incomplete. This user may need to complete registration.</p>' : ''}
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
        
        <div class="user-password-section">
          <h3>Password Management</h3>
          <p>As an admin, you can generate a password reset link for this user.</p>
          <button id="generate-reset-link" class="action-btn" onclick="window.generatePasswordResetLink('${userId}')">Generate Password Reset Link</button>
          <div id="password-reset-result" style="margin-top: 10px; display: none;"></div>
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
  } catch (error) {
    console.error('Error loading user details:', error);
    alert('Error loading user details: ' + error.message);
  }
};

// Function to show recovery options dialog
window.showRecoverOptions = function(userId, email, userData) {
  // Create recovery options dialog
  const recoverDialog = document.createElement('div');
  recoverDialog.id = 'recover-dialog';
  recoverDialog.className = 'recover-dialog';
  
  // Determine which fields are missing
  const missingFirstName = !userData.firstName;
  const missingLastName = !userData.lastName;
  const missingUsername = !userData.username;
  const missingPhoneNumber = !userData.phoneNumber;
  
  // Generate suggested values
  let suggestedFirstName = '';
  let suggestedLastName = '';
  
  if (email) {
    // Try to extract first name from email
    const emailParts = email.split('@')[0];
    
    if (emailParts.includes('.')) {
      suggestedFirstName = emailParts.split('.')[0];
      // Try to get last name initial if available
      if (emailParts.split('.').length > 1) {
        suggestedLastName = emailParts.split('.')[1];
      }
    } else if (emailParts.includes('_')) {
      suggestedFirstName = emailParts.split('_')[0];
      // Try to get last name initial if available
      if (emailParts.split('_').length > 1) {
        suggestedLastName = emailParts.split('_')[1];
      }
    } else {
      suggestedFirstName = emailParts;
    }
    
    // Capitalize first letter
    suggestedFirstName = suggestedFirstName.charAt(0).toUpperCase() + suggestedFirstName.slice(1).toLowerCase();
    
    if (suggestedLastName) {
      suggestedLastName = suggestedLastName.charAt(0).toUpperCase() + suggestedLastName.slice(1).toLowerCase();
    }
  }
  
  // Always generate the username in the correct format
  let suggestedUsername = '';
  
  if (suggestedFirstName && suggestedLastName) {
    // Format: "FirstName. LastInitial"
    suggestedUsername = `${suggestedFirstName}. ${suggestedLastName.charAt(0)}`;
  } else if (suggestedFirstName) {
    // If we only have first name, just add the dot and space
    suggestedUsername = `${suggestedFirstName}. `;
  } else if (email) {
    // Fallback to email
    suggestedUsername = email.split('@')[0];
  }
  
  recoverDialog.innerHTML = `
    <div class="recover-dialog-content">
      <h3>Recover Missing Information</h3>
      <p>Select which information to recover for this user:</p>
      <form id="recover-form">
        ${missingFirstName ? `
          <div class="recover-field">
            <input type="checkbox" id="recover-firstName" name="firstName" checked>
            <label for="recover-firstName">First Name:</label>
            <input type="text" id="firstName-value" value="${suggestedFirstName}" placeholder="Enter first name">
          </div>
        ` : ''}
        
        ${missingLastName ? `
          <div class="recover-field">
            <input type="checkbox" id="recover-lastName" name="lastName" checked>
            <label for="recover-lastName">Last Name:</label>
            <input type="text" id="lastName-value" value="${suggestedLastName}" placeholder="Enter last name">
            <small>Even a single letter is fine; only the first letter will be used in the username</small>
          </div>
        ` : ''}
        
        ${missingUsername ? `
          <div class="recover-field">
            <input type="checkbox" id="recover-username" name="username" checked>
            <label for="recover-username">Username:</label>
            <input type="text" id="username-value" value="${suggestedUsername}" placeholder="Enter username">
            <small>Will be automatically formatted as "FirstName. LastInitial" (e.g., "Ray. C")</small>
          </div>
        ` : ''}
        
        ${missingPhoneNumber ? `
          <div class="recover-field">
            <input type="checkbox" id="recover-phoneNumber" name="phoneNumber" checked>
            <label for="recover-phoneNumber">Phone Number:</label>
            <input type="text" id="phoneNumber-value" value="" placeholder="Enter phone number (e.g., 123-456-7890)">
          </div>
        ` : ''}
        
        ${!userData.termsAccepted ? `
          <div class="recover-field">
            <input type="checkbox" id="recover-terms" name="terms" checked>
            <label for="recover-terms">Accept Terms:</label>
            <span>Set as accepted</span>
          </div>
        ` : ''}
        
        <div class="recover-buttons">
          <button type="button" id="recover-cancel" class="cancel-btn">Cancel</button>
          <button type="button" id="recover-apply" class="apply-btn">Apply Changes</button>
        </div>
      </form>
    </div>
  `;
  
  // Add dialog to the document
  document.body.appendChild(recoverDialog);
  
  // Update username when first or last name changes
  const firstNameInput = document.getElementById('firstName-value');
  const lastNameInput = document.getElementById('lastName-value');
  const usernameInput = document.getElementById('username-value');
  
  if (firstNameInput && lastNameInput && usernameInput) {
    const updateUsername = function() {
      const firstName = firstNameInput.value.trim();
      const lastName = lastNameInput.value.trim();
      
      if (firstName) {
        // Capitalize first letter of first name
        const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        
        if (lastName) {
          // Format as "FirstName. LastInitial"
          const lastInitial = lastName.charAt(0).toUpperCase();
          usernameInput.value = `${capitalizedFirstName}. ${lastInitial}`;
        } else {
          // If we only have first name, use with a dot and space
          usernameInput.value = `${capitalizedFirstName}. `;
        }
      }
    };
    
    firstNameInput.addEventListener('input', updateUsername);
    lastNameInput.addEventListener('input', updateUsername);
  }
  
  // Disable username editing - only auto-generated based on first/last name
  if (usernameInput) {
    usernameInput.addEventListener('focus', function() {
      this.blur();
      alert('Username is automatically generated from First Name and Last Name to maintain the required format.');
    });
  }
  
  // Add event listeners
  document.getElementById('recover-cancel').addEventListener('click', function() {
    document.body.removeChild(recoverDialog);
  });
  
  document.getElementById('recover-apply').addEventListener('click', function() {
    const updates = {};
    
    // Get values from selected checkboxes
    if (missingFirstName && document.getElementById('recover-firstName').checked) {
      const firstName = document.getElementById('firstName-value').value.trim();
      if (firstName) {
        updates.firstName = firstName;
      }
    }
    
    if (missingLastName && document.getElementById('recover-lastName').checked) {
      const lastName = document.getElementById('lastName-value').value.trim();
      if (lastName) {
        updates.lastName = lastName;
      }
    }
    
    // Generate username with the correct format if either first or last name was updated
    if ((updates.firstName || updates.lastName) && document.getElementById('recover-username')?.checked) {
      const firstName = updates.firstName || userData.firstName || '';
      const lastName = updates.lastName || userData.lastName || '';
      
      if (firstName) {
        const capitalizedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        
        if (lastName) {
          const lastInitial = lastName.charAt(0).toUpperCase();
          updates.username = `${capitalizedFirstName}. ${lastInitial}`;
        } else {
          updates.username = `${capitalizedFirstName}. `;
        }
      }
    } else if (missingUsername && document.getElementById('recover-username')?.checked) {
      updates.username = document.getElementById('username-value').value.trim();
    }
    
    if (missingPhoneNumber && document.getElementById('recover-phoneNumber').checked) {
      const phoneNumber = document.getElementById('phoneNumber-value').value.trim();
      if (phoneNumber) {
        updates.phoneNumber = phoneNumber;
      }
    }
    
    if (!userData.termsAccepted && document.getElementById('recover-terms')?.checked) {
      updates.termsAccepted = true;
      updates.termsAcceptedDate = new Date().toISOString();
    }
    
    // Apply updates
    window.applyUserDataRecovery(userId, updates);
    
    // Remove the dialog
    document.body.removeChild(recoverDialog);
  });
  
  // Position the dialog
  recoverDialog.style.display = 'block';
};

// Function to apply user data recovery
window.applyUserDataRecovery = async function(userId, updates) {
  try {
    // Only update if there are changes
    if (Object.keys(updates).length > 0) {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, updates);
      
      // Show success message
      alert(`User data recovered successfully. Updated fields: ${Object.keys(updates).join(', ')}`);
      
      // Refresh the modal
      window.showUserDetails(userId);
    } else {
      alert('No changes selected for recovery.');
    }
  } catch (error) {
    console.error('Error recovering user data:', error);
    alert('Error recovering user data: ' + error.message);
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
    
    // Update the user data in the allUsers array
    const userIndex = allUsers.findIndex(user => user.uid === userId);
    if (userIndex !== -1) {
      allUsers[userIndex].userData.isAdmin = isAdmin;
      
      // Re-apply filters to update the displayed list
      applyFilters();
    }
    
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
    
    // Update the user data in the allUsers array
    const userIndex = allUsers.findIndex(user => user.uid === userId);
    if (userIndex !== -1) {
      allUsers[userIndex].userData.isSuperAdmin = makeUserSuperAdmin;
      allUsers[userIndex].userData.isAdmin = true;
      
      // Re-apply filters to update the displayed list
      applyFilters();
    }
    
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
  const confirmText = "Are you sure you want to delete this user? This action cannot be undone.";
  if (confirm(confirmText)) {
    try {
      // Show loading indicator
      const loadingMessage = document.createElement('div');
      loadingMessage.className = 'loading-message';
      loadingMessage.textContent = 'Deleting user...';
      loadingMessage.style.position = 'fixed';
      loadingMessage.style.top = '20px';
      loadingMessage.style.left = '50%';
      loadingMessage.style.transform = 'translateX(-50%)';
      loadingMessage.style.backgroundColor = '#2196F3';
      loadingMessage.style.color = 'white';
      loadingMessage.style.padding = '10px 20px';
      loadingMessage.style.borderRadius = '5px';
      loadingMessage.style.zIndex = '1000';
      document.body.appendChild(loadingMessage);
      
      console.log(`Attempting to delete user with UID: ${uid}`);
      
      // Step 1: Delete user from Firestore directly
      let firestoreDeleted = false;
      try {
        const userRef = doc(db, "users", uid);
        await deleteDoc(userRef);
        console.log(`User document deleted from Firestore: ${uid}`);
        firestoreDeleted = true;
      } catch (firestoreError) {
        console.warn("Could not delete user from Firestore directly:", firestoreError);
      }
      
      // Step 2: Try the recently deployed Cloud Function
      let deleteSuccess = false;
      
      try {
        // Direct method using fetch
        const response = await fetch(`https://deleteuser-lkkilrnjsq-uc.a.run.app`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            _method: 'DELETE',
            uid: uid
          })
        });
        
        // Log response status for debugging
        console.log("Cloud Function response status:", response.status);
      
      if (response.ok) {
          const responseData = await response.json();
          console.log("Delete response:", responseData);
          deleteSuccess = true;
      } else {
          console.warn("Delete request failed with status:", response.status);
          const errorText = await response.text();
          console.warn("Error response:", errorText);
        }
      } catch (fetchError) {
        console.warn("Error calling deleteUser function:", fetchError);
        
        // Fallback method using a form
        try {
          console.log("Trying form-based approach as fallback");
          const iframe = document.createElement('iframe');
          iframe.name = 'deleteframe';
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
          
          // Create a form that will make the request
          const form = document.createElement('form');
          form.action = `https://deleteuser-lkkilrnjsq-uc.a.run.app`;
          form.method = 'POST'; 
          form.target = 'deleteframe';
          
          // Add uid as a field
          const uidField = document.createElement('input');
          uidField.type = 'hidden';
          uidField.name = 'uid';
          uidField.value = uid;
          form.appendChild(uidField);
          
          // Add a hidden field to indicate this should be a DELETE operation
          const methodField = document.createElement('input');
          methodField.type = 'hidden';
          methodField.name = '_method';
          methodField.value = 'DELETE';
          form.appendChild(methodField);
          
          document.body.appendChild(form);
          form.submit();
          
          // Wait a bit to allow the request to process
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Clean up
          document.body.removeChild(iframe);
          document.body.removeChild(form);
          
          console.log("Delete request sent via form submission");
          deleteSuccess = true; // Assume success since we can't easily check the response
        } catch (formError) {
          console.warn("Error with form submission:", formError);
        }
      }
      
      // Step 3: Try refreshing the user list to see if deletion took effect
      try {
        // Get a fresh list of users
        const response = await fetch("https://us-central1-makeupbyny-1.cloudfunctions.net/listAllAuthUsers", {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include'
        });
        
        if (response.ok) {
          const users = await response.json();
          // Check if the user is still in the list
          const userStillExists = users.some(user => user.uid === uid);
          
          if (!userStillExists) {
            console.log("User confirmed deleted from Auth");
            deleteSuccess = true;
          } else {
            console.warn("User still exists in Auth after deletion attempts");
          }
        }
      } catch (checkError) {
        console.warn("Error checking if user was deleted:", checkError);
      }
      
      // Remove loading indicator
      document.body.removeChild(loadingMessage);
      
      // If either Firestore was deleted or we got a success from the Cloud Function
      if (firestoreDeleted || deleteSuccess) {
        console.log("User deletion succeeded");
        
        // Close modal if it's open
        if (modal.style.display === "block") {
          modal.style.display = "none";
        }
        
        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.textContent = 'User deleted successfully';
        successMessage.style.position = 'fixed';
        successMessage.style.top = '20px';
        successMessage.style.left = '50%';
        successMessage.style.transform = 'translateX(-50%)';
        successMessage.style.backgroundColor = '#4CAF50';
        successMessage.style.color = 'white';
        successMessage.style.padding = '10px 20px';
        successMessage.style.borderRadius = '5px';
        successMessage.style.zIndex = '1000';
        document.body.appendChild(successMessage);
        
        // Remove the user from allUsers array
        const userIndex = allUsers.findIndex(user => user.uid === uid);
        if (userIndex !== -1) {
          allUsers.splice(userIndex, 1);
          
          // Re-apply filters to update the displayed list
          applyFilters();
        } else {
          // If for some reason we can't find the user in the array,
          // remove the element from the DOM directly
          const userItems = document.querySelectorAll('.user-item');
          userItems.forEach(item => {
            if (item.getAttribute('data-uid') === uid) {
              item.remove();
            }
          });
        }
        
        // If no users left, show a message
        if (allUsers.length === 0) {
          const userList = document.getElementById("user-list");
          userList.innerHTML = '<li class="user-item">No users found.</li>';
        }
        
        // If deleted successfully, force a full reload after 3 seconds
        setTimeout(() => {
          document.body.removeChild(successMessage);
          // Force reload the page to ensure user list is updated
          window.location.reload();
        }, 3000);
      } else {
        // All deletion attempts failed
        console.error("Error deleting user: All deletion methods failed");
        
        // Show error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = 'Error deleting user. Please try again or check console for details.';
        errorMessage.style.position = 'fixed';
        errorMessage.style.top = '20px';
        errorMessage.style.left = '50%';
        errorMessage.style.transform = 'translateX(-50%)';
        errorMessage.style.backgroundColor = '#F44336';
        errorMessage.style.color = 'white';
        errorMessage.style.padding = '10px 20px';
        errorMessage.style.borderRadius = '5px';
        errorMessage.style.zIndex = '1000';
        document.body.appendChild(errorMessage);
        
        // Remove the error message after 5 seconds
        setTimeout(() => {
          document.body.removeChild(errorMessage);
        }, 5000);
      }
    } catch (error) {
      console.error("Error in deleteUser function:", error);
      alert("Error deleting user: " + error.message);
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

// Add a function to generate password reset links
window.generatePasswordResetLink = async function(userId) {
  try {
    // Get current admin user ID
    const adminUser = auth.currentUser;
    if (!adminUser) {
      alert('You must be logged in as an admin to perform this action.');
      return;
    }
    
    // Show loading state
    const resultDiv = document.getElementById('password-reset-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p>Generating reset link...</p>';
    
    // First try to use direct Firestore approach
    let email = null;
    try {
      // Get the user's email from the list item if possible
      const userItem = document.querySelector(`li[data-uid="${userId}"]`);
      if (userItem) {
        const emailMatch = userItem.innerHTML.match(/Email:<\/strong> ([^<|]+)/);
        if (emailMatch && emailMatch[1]) {
          email = emailMatch[1].trim();
        }
      }
      
      // If we couldn't get the email, try getting it from Firestore
      if (!email) {
        const userRef = doc(db, "users", userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          email = userData.email;
        }
      }
    } catch (error) {
      console.warn("Could not get user email directly:", error);
    }
    
    // If we have an email, we can use the Firebase Auth SDK directly
    if (email) {
      try {
        // This won't work in most cases due to security restrictions
        // but we'll try anyway in case the permissions are set up properly
        const auth = getAuth();
        const actionCodeSettings = {
          url: window.location.origin + '/login.html',
          handleCodeInApp: false
        };
        
        const resetLink = await sendPasswordResetEmail(auth, email);
        
        // If we get here, we were able to send a reset email directly
        resultDiv.innerHTML = `
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #ddd; margin-top: 10px;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Status:</strong> Password reset email sent successfully!</p>
            <p style="font-size: 0.9em; color: #666;">
              A password reset email has been sent to the user's email address.
            </p>
          </div>
        `;
        return;
      } catch (authError) {
        console.warn("Could not send reset email directly, falling back to Cloud Function:", authError);
      }
    }
    
    // CORS workaround using iframe approach
    const iframe = document.createElement('iframe');
    iframe.name = 'resetframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    // Create a promise to handle the response
    const resetPromise = new Promise((resolve, reject) => {
      // Add a script to receive the JSON response
      const scriptId = 'reset-script-' + Date.now();
      window[scriptId] = function(response) {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || "Unknown error"));
        }
        // Clean up
        document.head.removeChild(document.getElementById(scriptId));
        delete window[scriptId];
      };
      
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://us-central1-makeupbyny-1.cloudfunctions.net/generatePasswordResetLink?uid=${userId}&adminId=${adminUser.uid}&callback=${scriptId}`;
      document.head.appendChild(script);
      
      // Set a timeout
      setTimeout(() => {
        reject(new Error("Request timed out"));
        if (document.getElementById(scriptId)) {
          document.head.removeChild(document.getElementById(scriptId));
          delete window[scriptId];
        }
      }, 10000);
    });
    
    try {
      const result = await resetPromise;
      console.log("Password reset link generated:", result);
      
      // Display reset link
      resultDiv.innerHTML = `
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #ddd; margin-top: 10px;">
          <p><strong>Email:</strong> ${result.email}</p>
          <p><strong>Password Reset Link:</strong></p>
          <div style="margin: 10px 0; word-break: break-all; background: #fff; padding: 10px; border: 1px solid #ddd; border-radius: 3px;">
            <a href="${result.resetLink}" target="_blank">${result.resetLink}</a>
          </div>
          <p style="font-size: 0.9em; color: #666;">
            Note: This link can be used to reset the user's password. It expires after 24 hours.
          </p>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button onclick="navigator.clipboard.writeText('${result.resetLink}').then(() => alert('Reset link copied to clipboard'))">
              Copy Link
            </button>
            <button onclick="window.open('${result.resetLink}', '_blank')">Open Link</button>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Error generating password reset link:", error);
      
      // As a fallback, provide instructions for manual password reset
      resultDiv.innerHTML = `
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #ddd; margin-top: 10px; color: #721c24; background-color: #f8d7da; border-color: #f5c6cb;">
          <p><strong>Error generating reset link:</strong> ${error.message}</p>
          <p>As an alternative, you can:</p>
          <ol>
            <li>Go to the Firebase console</li>
            <li>Find this user (${userId})</li>
            <li>Use the "Reset Password" option there</li>
          </ol>
          <p>Or send the user a manual password reset email if you know their email address.</p>
        </div>
      `;
    } finally {
      // Clean up
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }
  } catch (error) {
    console.error("Error in generatePasswordResetLink function:", error);
    
    // Show error in the UI
    const resultDiv = document.getElementById('password-reset-result');
    if (resultDiv) {
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    } else {
      alert('Error generating password reset link: ' + error.message);
    }
  }
}; 
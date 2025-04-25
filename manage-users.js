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
  
  // Add event listeners for filter controls
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

  // Check if user is super admin
  const isUserSuperAdmin = await isSuperAdmin(user.uid);
  if (isUserSuperAdmin) {
    // User is admin, show admin dropdown menu
    if (loginLink) loginLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline";
    if (adminDropdownBtn) adminDropdownBtn.style.display = "inline";
    if (userAccountLink) userAccountLink.style.display = "inline";
    if (settingsIcon) settingsIcon.style.display = "flex";
    
    // For mobile, ensure positioning is applied when the button becomes visible
    if (window.innerWidth <= 480 && adminDropdownBtn) {
      adminDropdownBtn.setAttribute('style', 'display: inline; position: relative !important; top: -10px !important; margin-top: 0 !important; font-family: inherit !important; font-weight: normal !important; font-size: 0.85em !important;');
    }

    console.log("User is super admin, loading users...");
    // User is admin, load the users
    await loadUsers();
  } else {
    console.log("User is not super admin, redirecting to home page");
    content.innerHTML = '<div class="error-message">Access denied. Super Admin privileges required.</div>';
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
    return;
  }
});

// Handle admin dropdown functionality
if (adminDropdownBtn) {
  adminDropdownBtn.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Toggle dropdown visibility
    const dropdown = document.getElementById("adminDropdownContent");
    dropdown.classList.toggle("show-dropdown");
    this.classList.toggle("active");
    
    // For mobile: ensure the dropdown is positioned correctly
    if (window.innerWidth <= 480) {
      // Function to position dropdown below button
      const positionDropdown = () => {
        if (dropdown.classList.contains("show-dropdown")) {
          const buttonRect = this.getBoundingClientRect();
          
          dropdown.style.position = 'fixed';
          dropdown.style.top = (buttonRect.bottom + 5) + 'px';
          dropdown.style.left = (buttonRect.left + (buttonRect.width / 2)) + 'px';
          dropdown.style.transform = 'translateX(-50%)';
          dropdown.style.maxHeight = '80vh';
          dropdown.style.zIndex = '9999';
          
          const dropdownRect = dropdown.getBoundingClientRect();
          if (dropdownRect.bottom > window.innerHeight) {
            window.scrollBy(0, dropdownRect.bottom - window.innerHeight + 20);
          }
        }
      };
      
      // Position initially
      setTimeout(positionDropdown, 10);
      
      // Track scroll to reposition dropdown if needed
      const scrollHandler = () => {
        if (dropdown.classList.contains("show-dropdown")) {
          positionDropdown();
        } else {
          // Remove handler if dropdown is closed
          window.removeEventListener('scroll', scrollHandler);
          window._dropdownScrollHandler = null;
        }
      };
      
      // Store handler globally for later removal
      window._dropdownScrollHandler = scrollHandler;
      
      // Add scroll listener
      window.addEventListener('scroll', window._dropdownScrollHandler);
    }
  });
  
  // Close dropdown when clicking outside
  document.addEventListener("click", function(e) {
    // Don't close if clicking on the dropdown itself
    if (e.target.closest('.admin-dropdown-content')) {
      return;
    }
    
    // Only close if clicking outside the dropdown and its button
    if (!e.target.matches('#adminDropdownBtn') && 
        !e.target.matches('.dropdown-icon') && 
        !e.target.closest('#adminDropdownBtn')) {
      const dropdown = document.getElementById("adminDropdownContent");
      const btn = document.getElementById("adminDropdownBtn");
      if (dropdown && dropdown.classList.contains("show-dropdown")) {
        dropdown.classList.remove("show-dropdown");
        btn.classList.remove("active");
        
        // Reset inline styles when closing dropdown
        if (window.innerWidth <= 480) {
          setTimeout(() => {
            dropdown.style.position = '';
            dropdown.style.top = '';
            dropdown.style.left = '';
            dropdown.style.transform = '';
            dropdown.style.maxHeight = '';
          }, 300); // Wait for transition to complete
          
          // Remove any scroll handlers
          window.removeEventListener('scroll', window._dropdownScrollHandler);
          window._dropdownScrollHandler = null;
        }
      }
    }
  });
}

// Close modal when clicking the X
if (closeBtn) {
  closeBtn.onclick = function() {
    if (modal) {
    modal.style.display = "none";
    }
  };
}

// Close modal when clicking outside
window.onclick = function(event) {
  if (modal && event.target == modal) {
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

    // Deduplicate users by both UID and email to prevent duplicates
    const uniqueUsers = [];
    const userMap = new Map();
    const emailMap = new Map();
    
    for (const user of users) {
      // Skip users without email (should be rare but possible)
      if (!user.email) {
        console.log(`Skipping user without email, UID: ${user.uid}`);
        continue;
      }
      
      // Check if we've already seen this UID
      if (userMap.has(user.uid)) {
        console.log(`Skipping duplicate user with UID: ${user.uid}, email: ${user.email}`);
        continue;
      }
      
      // Check if we've already seen this email address
      if (emailMap.has(user.email)) {
        console.log(`Found duplicate account with same email: ${user.email}`);
        console.log(`  First account: ${emailMap.get(user.email)}`);
        console.log(`  This account: ${user.uid}`);
        
        // Skip this user since we already have one with the same email
        // The onAuthStateChanged handler in firebase-config.js will clean these up
        continue;
      }
      
      // Track both UID and email
      userMap.set(user.uid, true);
      emailMap.set(user.email, user.uid);
      uniqueUsers.push(user);
    }
    
    console.log(`Filtered out ${users.length - uniqueUsers.length} duplicate users`);

    // Loop through each unique user and create an HTML list item
    uniqueUsers.forEach(user => {
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
            <div class="user-avatar-container">
              ${getAvatarHTML(userData.avatarUrl, userData.username)}
            </div>
            <div class="user-info">
              <strong>Username:</strong> <span class="user-username">${userData.username || 'Not set'}</span> | 
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
      
      // Ensure we have the most current email from auth data
      if (authUserData.email && authUserData.email !== "Unknown") {
        userFullData.email = authUserData.email;
      }
    } else {
      console.log("No Firestore document exists for user:", userId);
      // Check if we need to create a document based on auth data
      if (authUserData.email && authUserData.email !== "Unknown") {
        console.log("Creating basic user profile from auth data");
        userFullData = {
          email: authUserData.email,
          isAdmin: false,
          isSuperAdmin: false,
          createdAt: new Date().toISOString()
        };
        
        // Save basic profile to Firestore
        try {
          await setDoc(userRef, userFullData);
          console.log("Created basic user profile in Firestore");
        } catch (createError) {
          console.error("Failed to create user profile:", createError);
        }
      } else {
        // Use minimal data if we don't have email
        userFullData = {
          email: "Unknown",
          isAdmin: false,
          isSuperAdmin: false
        };
      }
    }
    
    // If authUserData email is Unknown, try to extract from DOM
    if (authUserData.email === "Unknown") {
      const userItem = document.querySelector(`li[data-uid="${userId}"]`);
      if (userItem) {
        const emailMatch = userItem.innerHTML.match(/Email:<\/strong> ([^<|]+)/);
        if (emailMatch && emailMatch[1]) {
          authUserData.email = emailMatch[1].trim();
          if (!userFullData.email || userFullData.email === "Unknown") {
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
        <div class="user-avatar-large">
          ${getAvatarHTML(userFullData.avatarUrl, userFullData.username || '')}
        </div>
        <div class="user-basic-info">
          <div class="section-header">
          <h3>Basic Information</h3>
            <button type="button" class="edit-section-btn" data-section="basic">Edit</button>
          </div>
          <div class="section-content" id="basic-section-content">
            <p><strong>Username:</strong> <span id="username-display">${userFullData.username || 'Not provided'}</span></p>
          <p><strong>Email:</strong> ${authUserData.email || userFullData.email || 'Not provided'}</p>
          <p><strong>UID:</strong> ${userId}</p>
            <p><strong>Status:</strong> <span id="status-display">${authUserData.disabled ? 'Disabled' : 'Active'}</span></p>
          <p><strong>Role:</strong> <span class="user-role ${roleClass}">${roleDisplay}</span></p>
          </div>
          <div class="section-edit" id="basic-section-edit" style="display: none;">
            <form id="basic-info-form">
              <div class="form-group">
                <label for="username-edit">Username:</label>
                <input type="text" id="username-edit" value="${userFullData.username || ''}" disabled>
                <small>Username can be edited in the Personal Information section</small>
              </div>
              <div class="form-group">
                <label for="email-edit">Email:</label>
                <input type="email" id="email-edit" value="${authUserData.email || userFullData.email || ''}" disabled>
                <small>Email cannot be changed directly</small>
              </div>
              <div class="form-group">
                <label for="status-edit">Status:</label>
                <select id="status-edit">
                  <option value="active" ${!authUserData.disabled ? 'selected' : ''}>Active</option>
                  <option value="disabled" ${authUserData.disabled ? 'selected' : ''}>Disabled</option>
                </select>
              </div>
              <div class="form-actions">
                <button type="button" class="cancel-edit-btn" data-section="basic">Cancel</button>
                <button type="button" class="save-edit-btn" data-section="basic">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
        
        <div class="user-personal-info">
          <div class="section-header">
          <h3>Personal Information</h3>
            <button type="button" class="edit-section-btn" data-section="personal">Edit</button>
          </div>
          ${!userSignupComplete ? '<p class="warning-message">⚠️ User signup data is incomplete. This user may need to complete registration.</p>' : ''}
          <div class="section-content" id="personal-section-content">
            <p><strong>First Name:</strong> <span id="firstName-display">${userFullData.firstName || 'Not provided'}</span></p>
            <p><strong>Last Name:</strong> <span id="lastName-display">${userFullData.lastName || 'Not provided'}</span></p>
            <p><strong>Phone Number:</strong> <span id="phoneNumber-display">${userFullData.phoneNumber || 'Not provided'}</span></p>
          </div>
          <div class="section-edit" id="personal-section-edit" style="display: none;">
            <form id="personal-info-form">
              <div class="form-group">
                <label for="firstName-edit">First Name:</label>
                <input type="text" id="firstName-edit" value="${userFullData.firstName || ''}">
              </div>
              <div class="form-group">
                <label for="lastName-edit">Last Name:</label>
                <input type="text" id="lastName-edit" value="${userFullData.lastName || ''}">
              </div>
              <div class="form-group">
                <label for="username-edit">Username:</label>
                <input type="text" id="username-edit" value="${userFullData.username || ''}" readonly>
                <small>Username is automatically generated from first name and last initial</small>
              </div>
              <div class="form-group">
                <label for="phoneNumber-edit">Phone Number:</label>
                <input type="tel" id="phoneNumber-edit" value="${userFullData.phoneNumber || ''}">
              </div>
              <div class="form-actions">
                <button type="button" class="cancel-edit-btn" data-section="personal">Cancel</button>
                <button type="button" class="save-edit-btn" data-section="personal">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
        
        <div class="user-account-info">
          <div class="section-header">
          <h3>Account Information</h3>
            <button type="button" class="edit-section-btn" data-section="account">Edit</button>
          </div>
          <div class="section-content" id="account-section-content">
          <p><strong>Account Created:</strong> ${createdAtDisplay}</p>
            <p><strong>Terms & Policy Accepted:</strong> <span id="terms-display">${userFullData.termsAccepted ? 'Yes' : 'No'}</span></p>
            <p><strong>Acceptance Date:</strong> <span id="termsDate-display">${termsAcceptedDateDisplay}</span></p>
          </div>
          <div class="section-edit" id="account-section-edit" style="display: none;">
            <form id="account-info-form">
              <div class="form-group">
                <label for="terms-edit">Terms & Policy:</label>
                <select id="terms-edit">
                  <option value="true" ${userFullData.termsAccepted ? 'selected' : ''}>Accepted</option>
                  <option value="false" ${!userFullData.termsAccepted ? 'selected' : ''}>Not Accepted</option>
                </select>
              </div>
              <div class="form-group terms-date-group" ${!userFullData.termsAccepted ? 'style="display: none;"' : ''}>
                <label for="terms-date-edit">Acceptance Date:</label>
                <input type="datetime-local" id="terms-date-edit" value="${formatDateTimeLocal(userFullData.termsAcceptedDate)}">
              </div>
              <div class="form-actions">
                <button type="button" class="cancel-edit-btn" data-section="account">Cancel</button>
                <button type="button" class="save-edit-btn" data-section="account">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
        
        <div class="user-password-section">
          <h3>Password Management</h3>
          <p>As an admin, you can manage this user's password:</p>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px;">
            <button id="show-set-password" class="action-btn" onclick="window.showSetPasswordForm('${userId}')">Set New Password</button>
          </div>
          <div id="password-reset-result" style="margin-top: 10px; display: none;"></div>
          <div id="set-password-form" style="margin-top: 15px; display: none;">
            <form id="password-form" onsubmit="window.setNewPassword(event, '${userId}')">
              <div class="form-group">
                <label for="new-password">New Password:</label>
                <input type="password" id="new-password" required minlength="6">
                <small>Password must be at least 6 characters</small>
              </div>
              <div class="form-group">
                <label for="confirm-password">Confirm Password:</label>
                <input type="password" id="confirm-password" required>
              </div>
              <div class="form-actions">
                <button type="button" class="cancel-edit-btn" onclick="window.hideSetPasswordForm()">Cancel</button>
                <button type="submit" class="save-edit-btn">Save Password</button>
              </div>
            </form>
          </div>
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
    
    // Add event listeners for edit buttons
    document.querySelectorAll('.edit-section-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const section = this.getAttribute('data-section');
        document.getElementById(`${section}-section-content`).style.display = 'none';
        document.getElementById(`${section}-section-edit`).style.display = 'block';
        
        // If editing personal info, set focus to first name input
        if (section === 'personal') {
          const firstNameInput = document.getElementById('firstName-edit');
          if (firstNameInput) {
            setTimeout(() => firstNameInput.focus(), 100);
            
            // If username is empty or not set, auto-generate it from existing first/last name
            const usernameInput = document.getElementById('username-edit');
            if (usernameInput && (!usernameInput.value || usernameInput.value === 'Not provided')) {
              const firstName = firstNameInput.value.trim();
              const lastNameInput = document.getElementById('lastName-edit');
              const lastName = lastNameInput ? lastNameInput.value.trim() : '';
              
              if (firstName && lastName) {
                const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
                const lastInitial = lastName.charAt(0).toUpperCase();
                usernameInput.value = `${formattedFirstName}. ${lastInitial}`;
              } else if (firstName) {
                const formattedFirstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
                usernameInput.value = `${formattedFirstName}. `;
              }
            }
          }
        }
      });
    });
    
    // Add event listeners for cancel buttons
    document.querySelectorAll('.cancel-edit-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const section = this.getAttribute('data-section');
        document.getElementById(`${section}-section-edit`).style.display = 'none';
        document.getElementById(`${section}-section-content`).style.display = 'block';
      });
    });
    
    // Toggle terms date field visibility based on terms acceptance
    const termsSelect = document.getElementById('terms-edit');
    if (termsSelect) {
      termsSelect.addEventListener('change', function() {
        const termsDateGroup = document.querySelector('.terms-date-group');
        termsDateGroup.style.display = this.value === 'true' ? 'block' : 'none';
        
        // If switching to accepted, set current date
        if (this.value === 'true' && !document.getElementById('terms-date-edit').value) {
          document.getElementById('terms-date-edit').value = formatDateTimeLocal(new Date());
        }
      });
    }
  
  // Update username when first or last name changes
    const firstNameInput = document.getElementById('firstName-edit');
    const lastNameInput = document.getElementById('lastName-edit');
    const usernameInput = document.getElementById('username-edit');
  
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
  
    // Add event listeners for save buttons
    document.querySelectorAll('.save-edit-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const section = this.getAttribute('data-section');
        
        try {
          const updates = {};
          
          if (section === 'basic') {
            // Handle basic info updates
            const status = document.getElementById('status-edit').value;
            // We can't update the email directly, so we only handle user status
            
            // Update disabled state via Cloud Function (you'll need to implement this)
            const wasSuccessful = await updateUserStatus(userId, status === 'disabled');
            
            if (wasSuccessful) {
              document.getElementById('status-display').textContent = status === 'disabled' ? 'Disabled' : 'Active';
              
              // Update the allUsers array for filtering
              const userIndex = allUsers.findIndex(user => user.uid === userId);
              if (userIndex !== -1) {
                allUsers[userIndex].disabled = status === 'disabled';
                // Don't apply filters here as that would close the modal
              }
            }
          } 
          else if (section === 'personal') {
            // Handle personal info updates
            updates.firstName = document.getElementById('firstName-edit').value.trim();
            updates.lastName = document.getElementById('lastName-edit').value.trim();
            
            // Always auto-generate the username based on first name and last initial
            if (updates.firstName && updates.lastName) {
              const firstName = updates.firstName.charAt(0).toUpperCase() + updates.firstName.slice(1).toLowerCase();
              const lastInitial = updates.lastName.charAt(0).toUpperCase();
              updates.username = `${firstName}. ${lastInitial}`;
            } else if (updates.firstName) {
              const firstName = updates.firstName.charAt(0).toUpperCase() + updates.firstName.slice(1).toLowerCase();
              updates.username = `${firstName}. `;
            } else {
              // If no first name, just use a placeholder
              updates.username = 'User';
            }
            
            updates.phoneNumber = document.getElementById('phoneNumber-edit').value.trim();
            
            await updateDoc(doc(db, "users", userId), updates);
            
            // Update display values
            document.getElementById('firstName-display').textContent = updates.firstName || 'Not provided';
            document.getElementById('lastName-display').textContent = updates.lastName || 'Not provided';
            document.getElementById('username-display').textContent = updates.username || 'Not provided';
            document.getElementById('phoneNumber-display').textContent = updates.phoneNumber || 'Not provided';
            
            // Update the allUsers array for filtering
            const userIndex = allUsers.findIndex(user => user.uid === userId);
            if (userIndex !== -1) {
              allUsers[userIndex].userData = {...allUsers[userIndex].userData, ...updates};
              // Don't apply filters here as that would close the modal
              
              // Also update the username in the user list item if it exists
              const userItem = document.querySelector(`li[data-uid="${userId}"]`);
              if (userItem) {
                const usernameElement = userItem.querySelector('.user-username');
                if (usernameElement) {
                  usernameElement.textContent = updates.username || 'Not set';
                }
              }
            }
          } 
          else if (section === 'account') {
            // Handle account info updates
            const termsEditElement = document.getElementById('terms-edit');
            if (!termsEditElement) {
              console.warn('Could not find terms-edit element');
              return;
            }
            
            const termsAccepted = termsEditElement.value === 'true';
            updates.termsAccepted = termsAccepted;
            
            if (termsAccepted) {
              // Get the terms date from the input or use current date
              const termsDateInput = document.getElementById('terms-date-edit');
              updates.termsAcceptedDate = termsDateInput && termsDateInput.value 
                ? new Date(termsDateInput.value).toISOString() 
                : new Date().toISOString();
            } else {
              // If terms not accepted, clear the date
              updates.termsAcceptedDate = null;
            }
            
            await updateDoc(doc(db, "users", userId), updates);
            
            // Update display values
            const termsDisplayElement = document.getElementById('terms-display');
            if (termsDisplayElement) {
              termsDisplayElement.textContent = termsAccepted ? 'Yes' : 'No';
            }
            
            const formattedDate = updates.termsAcceptedDate 
              ? new Date(updates.termsAcceptedDate).toLocaleString() 
              : 'Not accepted';
            
            const termsDateDisplayElement = document.getElementById('termsDate-display');
            if (termsDateDisplayElement) {
              termsDateDisplayElement.textContent = formattedDate;
            }
          }
          
          // Hide edit form, show content
          const editSection = document.getElementById(`${section}-section-edit`);
          const contentSection = document.getElementById(`${section}-section-content`);
          
          if (editSection) {
            editSection.style.display = 'none';
          } else {
            console.warn(`Edit section not found: ${section}-section-edit`);
          }
          
          if (contentSection) {
            contentSection.style.display = 'block';
          } else {
            console.warn(`Content section not found: ${section}-section-content`);
          }
          
          // Show success message
          showNotification('Changes saved successfully', 'success');
        } catch (error) {
          console.error(`Error saving ${section} changes:`, error);
          showNotification(`Error: ${error.message}`, 'error');
        }
      });
    });
    
    modal.style.display = "block";
  } catch (error) {
    console.error('Error loading user details:', error);
    alert('Error loading user details: ' + error.message);
  }
};

// Helper function to show notifications
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}-notification`;
  notification.textContent = message;
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = type === 'success' ? '#4CAF50' : '#F44336';
  notification.style.color = 'white';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '5px';
  notification.style.zIndex = '1000';
  document.body.appendChild(notification);
  
  // Remove the notification after 3 seconds
  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
}

// Helper function to format date for datetime-local input
function formatDateTimeLocal(date) {
  if (!date) return '';
  
  try {
    let dateObj;
    
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (typeof date.toDate === 'function') {
      dateObj = date.toDate();
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }
    
    // Check if valid date
    if (isNaN(dateObj.getTime())) return '';
    
    // Format for datetime-local input: YYYY-MM-DDThh:mm
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    console.error("Error formatting date for input:", e);
    return '';
  }
}

// Function to update user status via a Cloud Function
async function updateUserStatus(userId, disabled) {
  try {
    // Get current admin user ID
    const adminUser = auth.currentUser;
    if (!adminUser) {
      throw new Error("You must be logged in as an admin to perform this action.");
    }
    
    // Create a loading indicator
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'loading-message';
    loadingMessage.textContent = 'Updating user status...';
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
    
    console.log(`Attempting to update status for user with UID: ${userId} to ${disabled ? 'disabled' : 'active'}`);
    
    // Call the deployed Cloud Function
    const response = await fetch('https://us-central1-makeupbyny-1.cloudfunctions.net/updateUserStatus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        uid: userId,
        disabled: disabled,
        adminId: adminUser.uid
      })
    });
    
    // Remove the loading indicator
    document.body.removeChild(loadingMessage);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("Status update result:", result);
    
    // Show success notification
    showNotification(result.message || "User status updated successfully", "success");
    
    // Update the UI in the user item list
    updateUserListItemStatus(userId, disabled);
    
    return true;
  } catch (error) {
    console.error("Error updating user status:", error);
    showNotification(`Error updating user status: ${error.message}`, "error");
    return false;
  }
}

// Helper function to update user status in the user list
function updateUserListItemStatus(userId, disabled) {
  updateUserListItemInfo(userId, { disabled: disabled });
}

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

// Add function to show password management section in user details modal
function showPasswordManagement(userId) {
  try {
    // Create password management section
    const passwordSection = document.createElement('div');
    passwordSection.id = 'passwordManagement';
    passwordSection.className = 'password-management';
    
    // Add title
    const title = document.createElement('h4');
    title.textContent = 'Password Management';
    passwordSection.appendChild(title);
    
    // Add set password button
    const setPasswordButton = document.createElement('button');
    setPasswordButton.id = 'show-set-password';
    setPasswordButton.textContent = 'Set New Password';
    setPasswordButton.className = 'action-btn';
    setPasswordButton.onclick = function() {
      try {
        window.showSetPasswordForm(userId);
      } catch (error) {
        console.error("Error in set password button click handler:", error);
        showNotification("Error setting up password form", "error");
      }
    };
    passwordSection.appendChild(setPasswordButton);
    
    // Add password form container (initially hidden)
    const setPasswordForm = document.createElement('div');
    setPasswordForm.id = 'set-password-form';
    setPasswordForm.style.display = 'none';
    setPasswordForm.style.marginTop = '15px';
    
    // Create the password form
    const passwordForm = document.createElement('form');
    passwordForm.id = 'password-form';
    passwordForm.onsubmit = function(event) {
      event.preventDefault();
      try {
        window.setNewPassword(event, userId);
      } catch (error) {
        console.error("Error in password form submission:", error);
        showNotification("Error submitting password form", "error");
      }
    };
    
    // Create password field
    const newPasswordGroup = document.createElement('div');
    newPasswordGroup.className = 'form-group';
    
    const newPasswordLabel = document.createElement('label');
    newPasswordLabel.htmlFor = 'new-password';
    newPasswordLabel.textContent = 'New Password:';
    
    const newPasswordInput = document.createElement('input');
    newPasswordInput.type = 'password';
    newPasswordInput.id = 'new-password';
    newPasswordInput.required = true;
    newPasswordInput.minLength = 6;
    
    const passwordHelp = document.createElement('small');
    passwordHelp.textContent = 'Password must be at least 6 characters';
    
    newPasswordGroup.appendChild(newPasswordLabel);
    newPasswordGroup.appendChild(newPasswordInput);
    newPasswordGroup.appendChild(passwordHelp);
    
    // Create confirm password field
    const confirmPasswordGroup = document.createElement('div');
    confirmPasswordGroup.className = 'form-group';
    
    const confirmPasswordLabel = document.createElement('label');
    confirmPasswordLabel.htmlFor = 'confirm-password';
    confirmPasswordLabel.textContent = 'Confirm Password:';
    
    const confirmPasswordInput = document.createElement('input');
    confirmPasswordInput.type = 'password';
    confirmPasswordInput.id = 'confirm-password';
    confirmPasswordInput.required = true;
    
    confirmPasswordGroup.appendChild(confirmPasswordLabel);
    confirmPasswordGroup.appendChild(confirmPasswordInput);
    
    // Create form actions
    const formActions = document.createElement('div');
    formActions.className = 'form-actions';
    
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'cancel-edit-btn';
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = function() {
      try {
        window.hideSetPasswordForm();
  } catch (error) {
        console.error("Error in cancel button handler:", error);
        if (setPasswordForm) {
          setPasswordForm.style.display = 'none';
        }
      }
    };
    
    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'save-edit-btn';
    saveButton.textContent = 'Save Password';
    
    formActions.appendChild(cancelButton);
    formActions.appendChild(saveButton);
    
    // Add all elements to form
    passwordForm.appendChild(newPasswordGroup);
    passwordForm.appendChild(confirmPasswordGroup);
    passwordForm.appendChild(formActions);
    
    // Add form to container
    setPasswordForm.appendChild(passwordForm);
    
    // Add password result div
    const resultDiv = document.createElement('div');
    resultDiv.id = 'password-reset-result';
    resultDiv.style.display = 'none';
    resultDiv.style.marginTop = '10px';
    
    // Add all to password section
    passwordSection.appendChild(setPasswordButton);
    passwordSection.appendChild(setPasswordForm);
    passwordSection.appendChild(resultDiv);
  
  return passwordSection;
  } catch (error) {
    console.error("Error creating password management section:", error);
    // Return a basic div with error message if something went wrong
    const errorDiv = document.createElement('div');
    errorDiv.textContent = "Error loading password management options";
    errorDiv.style.color = "red";
    return errorDiv;
  }
}

// Helper function to update user info in the list item
function updateUserListItemInfo(userId, updates, refreshElement = false) {
  const userItems = document.querySelectorAll('.user-item');
  let userItem = null;
  
  userItems.forEach(item => {
    if (item.getAttribute('data-uid') === userId) {
      userItem = item;
    }
  });
  
  if (userItem) {
    const userInfo = userItem.querySelector('.user-info');
    
    if (refreshElement) {
      // Generate new HTML for the entire info section
      const existingHTML = userInfo.innerHTML;
      
      // Extract username from HTML or use from updates
      let username = updates.username;
      if (!username) {
        const usernameMatch = existingHTML.match(/Username:<\/strong> <span class="user-username">([^<]+)<\/span>/);
        username = usernameMatch ? usernameMatch[1] : 'Not set';
      }
      
      // Extract email from HTML
      const emailMatch = existingHTML.match(/Email:<\/strong> ([^<|]+)/);
      const email = emailMatch ? emailMatch[1].trim() : '';
      
      // Extract UID from HTML
      const uidMatch = existingHTML.match(/UID:<\/strong> ([^<|]+)/);
      const uid = uidMatch ? uidMatch[1].trim() : userId;
      
      // Extract disabled status from HTML or use from updates
      let status = '';
      if (typeof updates.disabled === 'boolean') {
        status = updates.disabled ? 'Disabled' : 'Active';
      } else {
        status = existingHTML.includes('Status:</strong> Disabled') ? 'Disabled' : 'Active';
      }
      
      // Create new role span
      let roleDisplay = 'User';
      let roleClass = 'user-role';
      
      if (updates.isSuperAdmin) {
        roleDisplay = 'Super Admin';
        roleClass = 'super-admin-role';
      } else if (updates.isAdmin) {
        roleDisplay = 'Admin';
        roleClass = 'admin-role';
      }
      
      // Rebuild the user info HTML with username before email
      userInfo.innerHTML = `
        <strong>Username:</strong> <span class="user-username">${username}</span> | 
        <strong>Email:</strong> ${email} | 
        <strong>UID:</strong> ${uid} | 
        <strong>Status:</strong> ${status} |
        <strong>Role:</strong> <span class="user-role ${roleClass}">${roleDisplay}</span>
      `;
    } else {
      // Only update specific parts
      if (updates.username) {
        const usernameElement = userInfo.querySelector('.user-username');
        if (usernameElement) {
          usernameElement.textContent = updates.username;
        }
      }
      
      if (typeof updates.disabled === 'boolean') {
        const statusText = userInfo.innerHTML;
        const updatedStatus = statusText.replace(
          /Status:<\/strong> (Active|Disabled)/,
          `Status:</strong> ${updates.disabled ? 'Disabled' : 'Active'}`
        );
        userInfo.innerHTML = updatedStatus;
      }
      
      if (typeof updates.isAdmin === 'boolean' || typeof updates.isSuperAdmin === 'boolean') {
        const roleSpan = userInfo.querySelector('.user-role');
        if (roleSpan) {
          let roleDisplay = 'User';
          let roleClass = 'user-role';
          
          if (updates.isSuperAdmin) {
            roleDisplay = 'Super Admin';
            roleClass = 'super-admin-role';
          } else if (updates.isAdmin) {
            roleDisplay = 'Admin';
            roleClass = 'admin-role';
          }
          
          roleSpan.textContent = roleDisplay;
          roleSpan.className = `user-role ${roleClass}`;
        }
      }
    }
    
    return true;
  }
  
  return false;
}

// Update the updateUserRole function
window.updateUserRole = async function(userId, isAdmin) {
  try {
    // First update the UI to provide immediate feedback
    // Find the list item containing this user by iterating through all user items
    const userItems = document.querySelectorAll('.user-item');
    let userItem = null;
    userItems.forEach(item => {
      if (item.getAttribute('data-uid') === userId) {
        userItem = item;
      }
    });
    
    if (userItem) {
      // Update role display
      updateUserListItemInfo(userId, { isAdmin: isAdmin });
      
      // Update action buttons
      const userActions = userItem.querySelector('.user-actions');
      
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
    if (currentUserId === userId && modal && modal.style.display === "block") {
      window.showUserDetails(userId, { uid: userId, isAdmin: isAdmin, isSuperAdmin: false });
    }
  } catch (error) {
    console.error("Error updating user role:", error);
    alert("Error updating user role: " + error.message);
  }
};

// Update Super Admin role function
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
    const updates = {
      isSuperAdmin: makeUserSuperAdmin,
      isAdmin: true // Super admins are also admins
    };
    
    updateUserListItemInfo(userId, updates, true);
    
    // Find the list item to update action buttons
    const userItems = document.querySelectorAll('.user-item');
    let userItem = null;
    userItems.forEach(item => {
      if (item.getAttribute('data-uid') === userId) {
        userItem = item;
      }
    });
    
    if (userItem) {
      // Update action buttons
      const userActions = userItem.querySelector('.user-actions');
      
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
    await updateDoc(userRef, updates);
    
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
    if (currentUserId === userId && modal && modal.style.display === "block") {
      window.showUserDetails(userId, { uid: userId, isAdmin: true, isSuperAdmin: makeUserSuperAdmin });
    }
  } catch (error) {
    console.error("Error updating super admin role:", error);
    alert("Error updating super admin role: " + error.message);
  }
};

// Function to show password form
window.showSetPasswordForm = function(userId) {
  const setPasswordForm = document.getElementById('set-password-form');
  const newPasswordInput = document.getElementById('new-password');
  const resultDiv = document.getElementById('password-reset-result');
  
  if (setPasswordForm) {
    setPasswordForm.style.display = 'block';
  } else {
    console.error('set-password-form element not found');
  }
  
  if (newPasswordInput) {
    newPasswordInput.focus();
  }
  
  if (resultDiv) {
    resultDiv.style.display = 'none';
  }
};

// Function to hide password form
window.hideSetPasswordForm = function() {
  const setPasswordForm = document.getElementById('set-password-form');
  const passwordForm = document.getElementById('password-form');
  
  if (setPasswordForm) {
    setPasswordForm.style.display = 'none';
  }
  
  if (passwordForm) {
    passwordForm.reset();
  }
};

// Function to set a new password
window.setNewPassword = async function(event, userId) {
  event.preventDefault();
  
  // Get elements
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const resultDiv = document.getElementById('password-reset-result');
  const setPasswordForm = document.getElementById('set-password-form');
  const passwordForm = document.getElementById('password-form');
  
  if (!newPasswordInput || !confirmPasswordInput) {
    console.error('Password inputs not found');
    showNotification('Error finding password inputs', 'error');
    return;
  }
  
  // Get password values
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;
  
  // Validate passwords
  if (newPassword !== confirmPassword) {
    showNotification('Passwords do not match', 'error');
    return;
  }
  
  try {
    // Get current admin user ID
    const adminUser = auth.currentUser;
    if (!adminUser) {
      showNotification('You must be logged in as an admin to perform this action', 'error');
      return;
    }
    
    // Show loading state
    if (resultDiv) {
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p>Setting new password...</p>';
    }
    
    // Call the Cloud Function with mode: 'no-cors' to avoid CORS issues
    const response = await fetch('https://us-central1-makeupbyny-1.cloudfunctions.net/setUserPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        uid: userId,
        password: newPassword,  // Use 'password' as parameter name
        adminId: adminUser.uid
      })
    });
    
    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
      throw new Error('Error processing server response');
    }
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }
    
    // Display success
    if (resultDiv) {
    resultDiv.innerHTML = `
      <div style="background-color: #f1f8e9; padding: 15px; border-radius: 5px; border: 1px solid #c5e1a5; margin-top: 10px;">
        <p><strong>Success:</strong> Password has been updated successfully.</p>
        <p style="font-size: 0.9em; color: #558b2f;">
          The user can now log in with their new password.
        </p>
      </div>
    `;
    }
    
    // Hide form and reset it
    if (setPasswordForm) {
      setPasswordForm.style.display = 'none';
    }
    
    if (passwordForm) {
      passwordForm.reset();
    }
    
  } catch (error) {
    console.error("Error setting password:", error);
    
    // Show error in the UI
    if (resultDiv) {
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
      <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; border: 1px solid #ffcdd2; margin-top: 10px;">
        <p><strong>Error:</strong> ${error.message}</p>
        <p style="font-size: 0.9em; color: #c62828;">
          Please try using the password reset link instead.
        </p>
      </div>
    `;
    }
  }
};

// Add function to delete users
window.deleteUser = async function(userId) {
  // Ask for confirmation before proceeding
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
  
  try {
    // Get current admin user ID
    const adminUser = auth.currentUser;
    if (!adminUser) {
      showNotification('You must be logged in as an admin to perform this action', 'error');
      return;
    }
    
    // Show loading state
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
    
    console.log(`Attempting to delete user with UID: ${userId}`);
    
    // First, get the user's email to check for duplicates later
    let userEmail = null;
    try {
      // Find the user in our allUsers array to get their email
      const userToDelete = allUsers.find(user => user.uid === userId);
      if (userToDelete && userToDelete.email) {
        userEmail = userToDelete.email;
        console.log(`User being deleted has email: ${userEmail}`);
      } else {
        // Try to get from Firestore directly
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists() && userDoc.data().email) {
          userEmail = userDoc.data().email;
          console.log(`Found user email in Firestore: ${userEmail}`);
        }
      }
    } catch (emailError) {
      console.warn("Could not determine user email:", emailError);
    }
    
    let deletionSuccessful = false;
    
    // Try direct fetch method first (Cloud Function)
    try {
      const response = await fetch('https://us-central1-makeupbyny-1.cloudfunctions.net/deleteUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          uid: userId,
          adminId: adminUser.uid,
          _method: "DELETE" // Add method override for servers that don't support DELETE
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log("Delete user result:", result);
      deletionSuccessful = true;
    } catch (fetchError) {
      console.warn("Cloud Function deletion method failed:", fetchError);
      // Will continue with fallback methods
    }
    
    // If Cloud Function failed, try direct Firestore deletion as fallback
    if (!deletionSuccessful) {
      console.log("API call failed, trying direct Firestore deletion");
      try {
        // Delete the user document from Firestore
        await deleteDoc(doc(db, "users", userId));
        console.log(`User document deleted from Firestore for UID: ${userId}`);
        showNotification('User document deleted from Firestore, but the authentication record may still exist', 'warning');
        deletionSuccessful = true;
      } catch (firestoreError) {
        console.error("Error deleting user document from Firestore:", firestoreError);
        showNotification(`Error deleting user from Firestore: ${firestoreError.message}`, 'error');
      }
    }
    
    // After deleting the main account, check for duplicates with the same email
    if (deletionSuccessful && userEmail) {
      try {
        console.log(`Checking for duplicate accounts with email: ${userEmail}`);
        // Look for other accounts with the same email
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", userEmail));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          console.log(`Found ${querySnapshot.size} duplicate accounts with the same email`);
          
          // Delete all duplicate user documents
          const deletePromises = [];
          querySnapshot.forEach((doc) => {
            console.log(`Deleting duplicate user document: ${doc.id}`);
            deletePromises.push(deleteDoc(doc.ref));
          });
          
          // Wait for all deletions to complete
          await Promise.all(deletePromises);
          console.log("All duplicate user documents deleted");
        }
      } catch (duplicateError) {
        console.error("Error cleaning up duplicate accounts:", duplicateError);
      }
    }
    
    // Update the UI regardless of deletion method success
    if (deletionSuccessful) {
      // Remove the user from the UI
      const userItem = document.querySelector(`li[data-uid="${userId}"]`);
      if (userItem) {
        userItem.remove();
      }
      
      // Remove from allUsers array to prevent showing in filtered views
      const userIndex = allUsers.findIndex(user => user.uid === userId);
      if (userIndex !== -1) {
        allUsers.splice(userIndex, 1);
        
        // Also remove any other users with the same email
        if (userEmail) {
          const duplicateIndices = [];
          allUsers.forEach((user, index) => {
            if (user.email === userEmail) {
              duplicateIndices.push(index);
            }
          });
          
          // Remove duplicates from highest index to lowest to avoid shifting issues
          duplicateIndices.sort((a, b) => b - a).forEach(index => {
            console.log(`Removing duplicate user from UI: ${allUsers[index].uid}`);
            allUsers.splice(index, 1);
          });
        }
        
        // Re-apply filters to update the displayed list
        applyFilters();
      }
      
      // Close modal if open
      if (modal && modal.style.display === "block" && currentUserId === userId) {
        modal.style.display = "none";
      }
      
      showNotification('User deleted successfully', 'success');
    }
  } catch (error) {
    console.error("Error in deleteUser function:", error);
    showNotification(`Error deleting user: ${error.message}`, 'error');
  } finally {
    // Remove the loading indicator
    const loadingMessage = document.querySelector('.loading-message');
    if (loadingMessage && document.body.contains(loadingMessage)) {
      document.body.removeChild(loadingMessage);
    }
  }
};

function showUserDetails(userId) {
  // Fetch user data from Firestore
  const userRef = doc(db, "users", userId);
  getDoc(userRef).then((docSnap) => {
    if (docSnap.exists()) {
      const userData = docSnap.data();
      
      // Store the current user ID so we can reference it later
      currentUserId = userId;
      
      // Check if the elements exist before trying to update them
      const userNameElement = document.getElementById('user-name');
      const userEmailElement = document.getElementById('user-email');
      const userPhoneElement = document.getElementById('user-phone');
      const userRoleElement = document.getElementById('user-role');
      
      if (userNameElement) userNameElement.textContent = userData.displayName || 'No name provided';
      if (userEmailElement) userEmailElement.textContent = userData.email || 'No email provided';
      if (userPhoneElement) userPhoneElement.textContent = userData.phoneNumber || 'No phone provided';
      if (userRoleElement) userRoleElement.textContent = userData.role || 'No role assigned';
      
      // Show user profile image if available
      const userImage = document.getElementById('user-image');
      if (userImage) {
      if (userData.photoURL) {
        userImage.src = userData.photoURL;
        userImage.style.display = 'block';
      } else {
        userImage.style.display = 'none';
        }
      }
      
      // Set up role selection dropdown
      const roleSelect = document.getElementById('role-select');
      if (roleSelect) {
      roleSelect.value = userData.role || 'customer';
      }
      
      // Show the delete button
      const deleteButton = document.getElementById('delete-user-button');
      if (deleteButton) {
        deleteButton.style.display = 'block';
        deleteButton.onclick = function() {
          window.deleteUser(userId);
        };
      }
      
      // Show password management section
      const passwordManagementSection = showPasswordManagement(userId);
      
      // Find password management container or create one if it doesn't exist
      let passwordContainer = document.getElementById('password-management-container');
      if (!passwordContainer) {
        // If there's no dedicated container, try to append to the modal content
        const modalContent = document.getElementById('modalContent');
        if (modalContent) {
          passwordContainer = document.createElement('div');
          passwordContainer.id = 'password-management-container';
          modalContent.appendChild(passwordContainer);
        }
      }
      
      // Append the password management section if container exists
      if (passwordContainer && passwordManagementSection) {
        // Clear any existing content
        passwordContainer.innerHTML = '';
        passwordContainer.appendChild(passwordManagementSection);
      }
      
      // Check if the modal variable exists and has style property
      if (typeof modal !== 'undefined' && modal !== null && typeof modal.style !== 'undefined') {
      modal.style.display = "block";
      } else {
        console.warn("Modal element is not properly initialized");
      }
    } else {
      showNotification('User data not found', 'error');
    }
  }).catch((error) => {
    console.error("Error getting user data:", error);
    showNotification('Error retrieving user data: ' + error.message, 'error');
  });
}

// Helper function to display an avatar/profile image
function getAvatarHTML(avatarUrl, username) {
    // If it's a full URL already, use it directly
    if (avatarUrl && avatarUrl.startsWith('http')) {
        return `<img src="${avatarUrl}" alt="${username}'s avatar" class="user-avatar">`;
    } 
    // Check if it's one of our avatar file names (avatar1.png, etc.)
    else if (avatarUrl && (avatarUrl.match(/avatar([1-9]|1[0-2])\.png/) || avatarUrl.match(/avatar([1-9]|1[0-2])\.jpg/))) {
        // Use the actual avatar image file
        return `<img src="images/avatar-icons/${avatarUrl}" alt="${username}'s avatar" class="user-avatar">`;
    }
    // Fallback to placeholder
    else {
        const initial = username ? username.charAt(0).toUpperCase() : 'U';
        return `<img src="https://ui-avatars.com/api/?name=${initial}&background=random&color=fff&size=128" alt="${username}'s avatar" class="user-avatar">`;
    }
}
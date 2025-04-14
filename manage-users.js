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
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Add custom styles to improve user experience
const styleElement = document.createElement('style');
styleElement.textContent = `
  /* Loading spinner and animations */
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .loading-spinner {
    margin: 20px auto;
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .small-spinner {
    width: 20px;
    height: 20px;
    display: inline-block;
    vertical-align: middle;
    margin-right: 8px;
  }
  
  /* Progress bar styling */
  .progress-bar {
    height: 10px;
    background: #eee;
    border-radius: 5px;
    margin: 10px 0;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    background: #3498db;
    border-radius: 5px;
    transition: width 0.3s ease;
  }
  
  /* User item styling */
  .user-item {
    position: relative;
    transition: background-color 0.3s ease;
  }
  
  .user-item:hover {
    background-color: #f5f5f5;
  }
  
  .view-details-btn {
    position: relative;
    overflow: hidden;
  }
  
  .view-details-btn::after {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transition: 0.5s;
  }
  
  .view-details-btn:hover::after {
    left: 100%;
  }
  
  /* Modal improvements */
  .user-details-container {
    animation: fadeIn 0.3s ease;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  /* Status indicators */
  .warning-message {
    background-color: #fff3cd;
    color: #856404;
    padding: 10px;
    border-radius: 4px;
    border-left: 4px solid #ffeeba;
    margin-bottom: 15px;
  }
  
  .recover-btn {
    background-color: #17a2b8;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 15px;
    transition: background-color 0.2s;
  }
  
  .recover-btn:hover {
    background-color: #138496;
  }
  
  /* Error state styling */
  .user-item.error {
    border-left: 4px solid #dc3545;
  }
`;
document.head.appendChild(styleElement);

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
    
    // Show loading indicator
    userList.innerHTML = "";
    const loadingItem = document.createElement("li");
    loadingItem.className = "user-item";
    loadingItem.innerHTML = `
      <div class="user-info" style="text-align: center;">
        <div class="loading-spinner" style="margin: 20px auto; width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <p>Loading users...</p>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </div>
    `;
    userList.appendChild(loadingItem);
    
    // Implement retry mechanism for API fetch
    const fetchUsers = async (retryCount = 0, maxRetries = 3) => {
      try {
        console.log(`Fetching users attempt ${retryCount + 1}/${maxRetries + 1}`);
        
        // Add cache-busting parameter
        const timestamp = new Date().getTime();
        const url = `https://us-central1-makeupbyny-1.cloudfunctions.net/listAllAuthUsers?_=${timestamp}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store'
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const users = await response.json();
        console.log("Users received:", users.length);
        return users;
      } catch (error) {
        console.error(`Error fetching users (attempt ${retryCount + 1}):`, error);
        if (retryCount < maxRetries) {
          console.log("Retrying after error...");
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return await fetchUsers(retryCount + 1, maxRetries);
        }
        throw error; // Re-throw on final attempt
      }
    };
    
    // Fetch users with retry mechanism
    const users = await fetchUsers();
    
    userList.innerHTML = ""; // Clear loading indicator

    // Check if there are users
    if (users.length === 0) {
      console.log("No users found");
      userList.innerHTML = '<li class="user-item">No users found.</li>';
      return;
    }

    // Show progress indicator
    const progressItem = document.createElement("li");
    progressItem.className = "user-item";
    progressItem.innerHTML = `
      <div class="user-info" style="text-align: center;">
        <p>Processing users: <span id="progress-counter">0</span>/${users.length}</p>
        <div class="progress-bar" style="height: 10px; background: #eee; border-radius: 5px; margin: 10px 0;">
          <div id="progress-fill" style="width: 0%; height: 100%; background: #3498db; border-radius: 5px; transition: width 0.3s;"></div>
        </div>
      </div>
    `;
    userList.appendChild(progressItem);
    
    // Progress counter elements
    const progressCounter = document.getElementById("progress-counter");
    const progressFill = document.getElementById("progress-fill");
    let processedCount = 0;

    // Process users in smaller batches to avoid overwhelming Firestore
    const batchSize = 5;
    const userBatches = [];
    
    // Split users into batches
    for (let i = 0; i < users.length; i += batchSize) {
      userBatches.push(users.slice(i, i + batchSize));
    }
    
    const processedUsers = [];
    
    // Process each batch sequentially
    for (let batch of userBatches) {
      const batchPromises = batch.map(user => 
        (async () => {
          console.log("Processing user:", user.email);
          
          try {
            // Get user's data from Firestore with retries
            const getUserData = async (retry = 0, maxRetries = 2) => {
              try {
                const userRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userRef);
                
                if (userDoc.exists()) {
                  const userData = userDoc.data();
                  console.log(`User document found for ${user.email}:`, userData);
                  return userData;
                } else if (retry < maxRetries) {
                  console.log(`No document found for ${user.email}, retrying (${retry + 1}/${maxRetries + 1})...`);
                  await new Promise(resolve => setTimeout(resolve, 500));
                  return await getUserData(retry + 1, maxRetries);
                } else {
                  console.log(`No Firestore document found for ${user.email} after retries`);
                  return {
                    email: user.email,
                    isAdmin: false,
                    isSuperAdmin: false
                  };
                }
              } catch (error) {
                console.error(`Error getting user data for ${user.email} (attempt ${retry + 1}):`, error);
                if (retry < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                  return await getUserData(retry + 1, maxRetries);
                }
                throw error;
              }
            };
            
            const userData = await getUserData();
            
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
            
            // Create the user list item
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
            
            // Update progress
            processedCount++;
            if (progressCounter) progressCounter.textContent = processedCount;
            if (progressFill) progressFill.style.width = `${(processedCount / users.length) * 100}%`;
            
            return { element: li, userData: {...userData, ...user, uid: user.uid} };
          } catch (error) {
            console.error(`Error processing user ${user.email}:`, error);
            // Still update progress even on error
            processedCount++;
            if (progressCounter) progressCounter.textContent = processedCount;
            if (progressFill) progressFill.style.width = `${(processedCount / users.length) * 100}%`;
            
            // Return a simple error element
            const li = document.createElement("li");
            li.className = "user-item error";
            li.setAttribute('data-uid', user.uid);
            li.innerHTML = `
              <div class="user-info">
                <strong>Email:</strong> ${user.email} | 
                <strong>Error:</strong> Could not load complete data
              </div>
              <div class="user-actions">
                <button class="view-details-btn" data-uid="${user.uid}">View Details</button>
              </div>
            `;
            return { element: li, userData: { ...user, uid: user.uid } };
          }
        })()
      );
      
      // Process the current batch
      const batchResults = await Promise.all(batchPromises);
      processedUsers.push(...batchResults);
      
      // Small delay between batches to avoid overwhelming Firestore
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Remove progress indicator
    userList.innerHTML = "";
    
    // Append all user elements
    processedUsers.forEach(result => {
      userList.appendChild(result.element);
      
      // Add event listener directly to the button
      const viewDetailsBtn = result.element.querySelector('.view-details-btn');
      viewDetailsBtn.addEventListener('click', function() {
        window.showUserDetails(result.userData.uid, result.userData);
      });
    });
    
    console.log("All users loaded successfully");
  } catch (error) {
    console.error("Error fetching users:", error);
    userList.innerHTML = `
      <li class="user-item error">
        <div class="user-info">
          <p>Error loading users: ${error.message}</p>
          <button onclick="loadUsers()" style="margin-top: 10px; padding: 5px 10px; background: #5bc0de; color: white; border: none; border-radius: 4px; cursor: pointer;">Try Again</button>
        </div>
      </li>
    `;
  }
}

// Make functions available globally for onclick handlers
window.showUserDetails = async function(userId, userData = null) {
  currentUserId = userId;
  
  try {
    // Show loading state in the modal
    modal.style.display = "block";
    modalContent.innerHTML = `
      <div class="loading-container" style="text-align: center; padding: 30px;">
        <p>Loading user details...</p>
        <div class="loading-spinner" style="margin: 20px auto; width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </div>
    `;
    
    // Implement retry mechanism for fetching user data
    const fetchUserData = async (retryCount = 0, maxRetries = 3) => {
      try {
        console.log(`Fetching user data attempt ${retryCount + 1}/${maxRetries + 1}`);
        
        // Always fetch the latest user data from Firestore with cache-busting
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
          
          // Validate if we have all required fields
          const requiredFields = ['firstName', 'lastName', 'username', 'phoneNumber'];
          const missingFields = [];
          
          requiredFields.forEach(field => {
            if (!userFullData[field] || userFullData[field] === '') {
              missingFields.push(field);
            }
          });
          
          if (missingFields.length > 0 && retryCount < maxRetries) {
            // If missing fields and not on last retry, wait and try again
            console.log(`Missing fields detected: ${missingFields.join(', ')}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return await fetchUserData(retryCount + 1, maxRetries);
          }
        } else {
          console.log("No Firestore document exists for user:", userId);
          // If document doesn't exist and not on last retry, wait and try again
          if (retryCount < maxRetries) {
            console.log("Retrying fetch...");
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return await fetchUserData(retryCount + 1, maxRetries);
          }
          
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
        
        return { userFullData, authUserData };
      } catch (error) {
        console.error(`Error fetching user data (attempt ${retryCount + 1}):`, error);
        if (retryCount < maxRetries) {
          console.log("Retrying after error...");
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return await fetchUserData(retryCount + 1, maxRetries);
        }
        throw error; // Re-throw on final attempt
      }
    };
    
    // Fetch user data with retry mechanism
    const { userFullData, authUserData } = await fetchUserData();
    
    // Load comments with its own retry mechanism
    const commentsHtml = await loadUserComments(userId).catch(error => {
      console.error("Error loading comments:", error);
      return '<div class="user-comments-section"><h3>User Comments</h3><p>Error loading comments. Please try again.</p></div>';
    });
    
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
          ${!userSignupComplete ? 
            `<p class="warning-message">⚠️ User signup data is incomplete. This user may need to complete registration.</p>
             <button class="recover-btn" onclick="window.showRecoverOptions('${userId}', '${authUserData.email || userFullData.email || ''}', ${JSON.stringify(userFullData).replace(/"/g, '&quot;')})">Recover User Data</button>` 
            : ''}
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
  } catch (error) {
    console.error('Error loading user details:', error);
    modalContent.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h3 style="color: #d9534f;">Error Loading User Details</h3>
        <p>${error.message}</p>
        <button onclick="window.showUserDetails('${userId}', null)" style="margin-top: 15px; padding: 8px 16px; background: #5bc0de; color: white; border: none; border-radius: 4px; cursor: pointer;">Try Again</button>
      </div>
    `;
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
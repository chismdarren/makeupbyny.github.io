import { auth, db, isSuperAdmin } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut, 
    updatePassword, 
    reauthenticateWithCredential, 
    EmailAuthProvider,
    deleteUser 
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { 
    doc, 
    getDoc, 
    updateDoc,
    deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { initializeConnectionMonitoring } from './firebase-connection-handler.js';

// Connection handler
let connectionHandler;

// DOM elements
const notificationEl = document.getElementById('notification');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Form elements
const profileForm = document.getElementById('profile-form');
const passwordForm = document.getElementById('password-form');
const deleteAccountForm = document.getElementById('delete-account-form');

// Navigation elements
const adminDropdownBtn = document.getElementById('adminDropdownBtn');
const userAccountLink = document.getElementById('userAccountLink');
const loginLink = document.getElementById('login-link');
const logoutBtn = document.getElementById('logout-btn');
const logoutLink = document.getElementById('logout-link');

// User data
let currentUser = null;
let userData = null;

// Constants
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    console.log('Settings page loaded');
    
    // Initialize Firebase connection monitoring
    connectionHandler = initializeConnectionMonitoring(db);
    
    // Initially hide user account link until auth check completes
    if (userAccountLink) userAccountLink.style.display = 'none';
    
    // Set up tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    
    // Set up form submissions
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);
    if (passwordForm) passwordForm.addEventListener('submit', handlePasswordUpdate);
    if (deleteAccountForm) deleteAccountForm.addEventListener('submit', handleDeleteAccount);
    
    // Set up cancel buttons
    document.getElementById('profile-cancel').addEventListener('click', () => loadUserData());
    document.getElementById('password-cancel').addEventListener('click', () => passwordForm.reset());
    document.getElementById('delete-cancel').addEventListener('click', () => {
        document.getElementById('delete-confirm-password').value = '';
        document.getElementById('delete-confirmation').value = '';
    });
    
    // Check authentication state
    onAuthStateChanged(auth, handleAuthStateChange);
    
    // Set up dropdown functionality
    setupDropdowns();
    
    // Set up logout button
    setupLogout();
});

// Handle authentication state changes
async function handleAuthStateChange(user) {
    if (!user) {
        // Redirect to login if no user is logged in
        showNotification('You must be logged in to access this page', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }
    
    currentUser = user;
    console.log('Current user:', currentUser.email);
    
    // Update UI based on user role
    if (loginLink) loginLink.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline';
    if (userAccountLink) userAccountLink.style.display = 'inline';
    
    // Load user data before checking admin status
    await loadUserData();
    
    // Check if user is admin
    try {
        const userIsAdmin = await isSuperAdmin(currentUser.uid) || (userData && userData.isAdmin === true);
        console.log('User admin status:', userIsAdmin);
        
        // Only show admin dropdown for admins
        if (adminDropdownBtn) {
            adminDropdownBtn.style.display = userIsAdmin ? 'inline' : 'none';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
        // Default to not showing admin dropdown if there's an error
        if (adminDropdownBtn) adminDropdownBtn.style.display = 'none';
    }
    
    // Show settings icon when user is logged in
    const settingsIcon = document.getElementById('settingsIcon');
    if (settingsIcon) settingsIcon.style.display = 'flex';
}

// Load user data from Firestore
async function loadUserData() {
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            userData = userSnap.data();
            console.log('User data loaded:', userData);
            
            // Fill in profile form
            document.getElementById('firstName').value = userData.firstName || '';
            document.getElementById('lastName').value = userData.lastName || '';
            document.getElementById('username').value = userData.username || '';
            document.getElementById('email').value = currentUser.email || '';
            document.getElementById('phoneNumber').value = userData.phoneNumber || '';
            
            // Load current avatar if available
            if (userData.avatarUrl) {
                loadAvatar(userData.avatarUrl);
            }
        } else {
            console.log('No user data found, creating new document');
            userData = {
                email: currentUser.email,
                firstName: '',
                lastName: '',
                phoneNumber: '',
                createdAt: new Date().toISOString(),
                preferences: {
                    emailNotifications: false,
                    marketingEmails: false
                }
            };
        }
        
        // Set up avatar selection
        setupAvatarSelection();
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading user data: ' + error.message, 'error');
    }
}

// Load avatar image
function loadAvatar(avatarUrl) {
    const avatarImg = document.getElementById('currentAvatarImg');
    
    console.log("Loading avatar with URL:", avatarUrl);
    
    // If it's a full URL already, use it directly
    if (avatarUrl && avatarUrl.startsWith('http')) {
        console.log("Using full URL directly");
        avatarImg.src = avatarUrl;
    } 
    // Check if it's one of our avatar file names (avatar1.png, etc.)
    else if (avatarUrl && (avatarUrl.match(/avatar([1-9]|1[0-2])\.png/) || avatarUrl.match(/avatar([1-9]|1[0-2])\.jpg/))) {
        // Use the actual avatar image file
        console.log("Using local avatar file path:", `images/avatar-icons/${avatarUrl}`);
        avatarImg.src = `images/avatar-icons/${avatarUrl}`;
    }
    // Fallback to placeholder
    else {
        console.log("Using placeholder avatar");
        avatarImg.src = "https://ui-avatars.com/api/?name=User&background=random&color=fff&size=128";
    }
    
    // Find and pre-select the matching avatar option if available
    const avatarOptions = document.querySelectorAll('.avatar-option');
    avatarOptions.forEach(option => {
        option.classList.remove('selected');
        if (option.getAttribute('data-avatar') === avatarUrl) {
            option.classList.add('selected');
        }
    });
}

// Set up avatar selection functionality
function setupAvatarSelection() {
    let selectedAvatar = null;
    const saveAvatarBtn = document.getElementById('save-avatar-btn');
    const avatarOptions = document.querySelectorAll('.avatar-option');
    
    // Add click handlers to avatar options
    avatarOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all options
            avatarOptions.forEach(opt => opt.classList.remove('selected'));
            
            // Add selected class to clicked option
            option.classList.add('selected');
            
            // Store selected avatar
            selectedAvatar = option.getAttribute('data-avatar');
            
            // Show preview of selected avatar
            document.getElementById('currentAvatarImg').src = `images/avatar-icons/${selectedAvatar}`;
            
            // Enable save button
            saveAvatarBtn.disabled = false;
        });
    });
    
    // Handle save button click
    saveAvatarBtn.addEventListener('click', async () => {
        if (!selectedAvatar) return;
        
        try {
            // Show loading state
            saveAvatarBtn.textContent = 'Saving...';
            saveAvatarBtn.disabled = true;
            
            // Update user's profile in Firestore
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                avatarUrl: selectedAvatar,
                hasSelectedAvatar: true
            });
            
            // Update local user data
            userData.avatarUrl = selectedAvatar;
            
            // Show success message
            showNotification('Avatar updated successfully', 'success');
            
            // Reset button
            saveAvatarBtn.textContent = 'Update Avatar';
            saveAvatarBtn.disabled = true;
        } catch (error) {
            console.error('Error updating avatar:', error);
            showNotification('Error updating avatar: ' + error.message, 'error');
            
            // Reset button
            saveAvatarBtn.textContent = 'Update Avatar';
            saveAvatarBtn.disabled = false;
        }
    });
}

// Handle profile form submission
async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    
    // Validate phone number
    const phoneRegex = /^[0-9]{3}[-\s]?[0-9]{3}[-\s]?[0-9]{4}$/;
    if (phoneNumber && !phoneRegex.test(phoneNumber)) {
        showNotification('Please enter a valid phone number (format: 123-456-7890)', 'error');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        
        await updateDoc(userRef, {
            firstName,
            lastName,
            phoneNumber,
            updatedAt: new Date().toISOString()
        });
        
        // Update local user data
        userData.firstName = firstName;
        userData.lastName = lastName;
        userData.phoneNumber = phoneNumber;
        
        showNotification('Profile updated successfully', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Error updating profile: ' + error.message, 'error');
    }
}

// Handle password form submission
async function handlePasswordUpdate(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    // Validate passwords
    if (newPassword.length < 6) {
        showNotification('Password must be at least 6 characters long', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    try {
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        
        await reauthenticateWithCredential(currentUser, credential);
        
        // Update password
        await updatePassword(currentUser, newPassword);
        
        // Clear form
        passwordForm.reset();
        
        showNotification('Password updated successfully', 'success');
    } catch (error) {
        console.error('Error updating password:', error);
        
        if (error.code === 'auth/wrong-password') {
            showNotification('Current password is incorrect', 'error');
        } else {
            showNotification('Error updating password: ' + error.message, 'error');
        }
    }
}

// Add new function to handle account deletion
async function handleDeleteAccount(e) {
    e.preventDefault();
    
    const confirmPassword = document.getElementById('delete-confirm-password').value;
    const confirmText = document.getElementById('delete-confirmation').value;
    
    // Validate confirmation text
    if (confirmText !== 'DELETE') {
        showNotification('Please type DELETE in all capitals to confirm', 'error');
        return;
    }
    
    try {
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(
            currentUser.email,
            confirmPassword
        );
        
        // Show confirmation dialog
        if (!confirm('Are you absolutely sure you want to delete your account? This action CANNOT be undone.')) {
            return;
        }
        
        // Disable delete button during processing
        const deleteButton = document.getElementById('delete-account-button');
        const originalButtonText = deleteButton.textContent;
        deleteButton.disabled = true;
        deleteButton.textContent = 'Deleting...';
        
        try {
            // Re-authenticate first
            await reauthenticateWithCredential(currentUser, credential);
            
            // Delete user data from Firestore first
            if (currentUser.uid) {
                try {
                    const userDocRef = doc(db, 'users', currentUser.uid);
                    await deleteDoc(userDocRef);
                    console.log('User document deleted from Firestore');
                } catch (firestoreError) {
                    console.error('Error deleting user document from Firestore:', firestoreError);
                    // Continue with account deletion even if Firestore delete fails
                }
            }
            
            // Now delete the Firebase Auth user
            await deleteUser(currentUser);
            
            // Show success notification
            showNotification('Your account has been successfully deleted', 'success');
            
            // Redirect to homepage after 2 seconds
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        } catch (error) {
            console.error('Error during account deletion:', error);
            deleteButton.disabled = false;
            deleteButton.textContent = originalButtonText;
            
            if (error.code === 'auth/wrong-password') {
                showNotification('Incorrect password. Please try again.', 'error');
            } else {
                showNotification('Error deleting account: ' + error.message, 'error');
            }
        }
    } catch (error) {
        console.error('Error during authentication:', error);
        showNotification('Authentication error: ' + error.message, 'error');
    }
}

// Switch between tabs
function switchTab(tabId) {
    tabButtons.forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabId);
    });
    
    tabContents.forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

// Show notification
function showNotification(message, type) {
    notificationEl.innerHTML = message;
    notificationEl.className = `notification ${type}`;
    notificationEl.style.display = 'block';
    
    // Hide notification after 5 seconds
    setTimeout(() => {
        notificationEl.style.display = 'none';
    }, 5000);
}

// Set up dropdowns
function setupDropdowns() {
    // Admin dropdown 
    if (adminDropdownBtn) {
        adminDropdownBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle active class for button styling
            this.classList.toggle('active');
            
            // Toggle white box dropdown
            const whiteBoxDropdown = document.getElementById('adminWhiteBoxDropdown');
            
            if (whiteBoxDropdown.style.display === 'none' || !whiteBoxDropdown.style.display) {
                // Position the dropdown
                const btnRect = this.getBoundingClientRect();
                whiteBoxDropdown.style.top = (btnRect.bottom + 2) + 'px';
                whiteBoxDropdown.style.left = (btnRect.left - 130) + 'px';
                whiteBoxDropdown.style.display = 'block';
            } else {
                whiteBoxDropdown.style.display = 'none';
            }
        });
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.matches('.admin-dropdown-btn')) {
            // Hide white box dropdown
            const whiteBoxDropdown = document.getElementById('adminWhiteBoxDropdown');
            if (whiteBoxDropdown) {
                whiteBoxDropdown.style.display = 'none';
            }
            
            // Remove active class from button
            if (adminDropdownBtn) adminDropdownBtn.classList.remove('active');
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

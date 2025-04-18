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
let selectedProfileIcon = null;

// Constants
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";
const PROFILE_ICONS = [
    { id: 'icon-1', color: '#FF5733', name: 'Red' },
    { id: 'icon-2', color: '#33FF57', name: 'Green' },
    { id: 'icon-3', color: '#3357FF', name: 'Blue' },
    { id: 'icon-4', color: '#F3FF33', name: 'Yellow' },
    { id: 'icon-5', color: '#33FFF3', name: 'Cyan' },
    { id: 'icon-6', color: '#F333FF', name: 'Magenta' },
    { id: 'icon-7', color: '#FF33A8', name: 'Pink' },
    { id: 'icon-8', color: '#A833FF', name: 'Purple' },
    { id: 'icon-9', color: '#33A8FF', name: 'Sky Blue' },
    { id: 'icon-10', color: '#FF8C33', name: 'Orange' }
];

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
        document.getElementById('confirm-delete').checked = false;
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
    
    // If we have a user account link, update it to include the profile icon
    updateUserAccountLinkWithIcon();
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
            
            // Load profile icon if exists
            loadProfileIcon();
            
            // Load preferences
            loadUserPreferences();
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
            
            // Initialize profile icon with first letter
            initializeProfileIconDisplay();
        }
        
        // Load available profile icons
        loadProfileIcons();
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading user data: ' + error.message, 'error');
    }
}

// Load profile icon
function loadProfileIcon() {
    const profileIconPreview = document.getElementById('currentProfileIcon');
    const profileIconInitial = document.getElementById('profileIconInitial');
    
    if (!profileIconPreview) return;
    
    if (userData.profileIcon) {
        // User has a profile icon set
        const selectedIcon = PROFILE_ICONS.find(icon => icon.id === userData.profileIcon);
        if (selectedIcon) {
            profileIconPreview.innerHTML = '';
            profileIconPreview.style.backgroundColor = selectedIcon.color;
            selectedProfileIcon = userData.profileIcon;
        } else {
            // Fallback to initial if icon not found
            initializeProfileIconDisplay();
        }
    } else {
        // Use initial as fallback
        initializeProfileIconDisplay();
    }
}

// Initialize profile icon with user's initial
function initializeProfileIconDisplay() {
    const profileIconPreview = document.getElementById('currentProfileIcon');
    const profileIconInitial = document.getElementById('profileIconInitial');
    
    if (!profileIconPreview || !profileIconInitial) return;
    
    // Clear any existing styling
    profileIconPreview.style.backgroundColor = '#f0f0f0';
    
    // Clear any existing content
    profileIconPreview.innerHTML = '';
    profileIconPreview.appendChild(profileIconInitial);
    
    // Set initial based on first name or email
    let initial = '';
    if (userData && userData.firstName) {
        initial = userData.firstName.charAt(0).toUpperCase();
    } else if (currentUser && currentUser.email) {
        initial = currentUser.email.charAt(0).toUpperCase();
    }
    
    profileIconInitial.textContent = initial;
}

// Load profile icons for selection
async function loadProfileIcons() {
    const profileIconsGrid = document.getElementById('profileIconsGrid');
    if (!profileIconsGrid) return;
    
    // Clear loading message
    profileIconsGrid.innerHTML = '';
    
    // Add each icon as an option
    PROFILE_ICONS.forEach(icon => {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'profile-icon-option';
        iconDiv.style.backgroundColor = icon.color;
        
        if (userData.profileIcon === icon.id) {
            iconDiv.classList.add('selected');
        }
        
        iconDiv.dataset.icon = icon.id;
        iconDiv.title = icon.name;
        
        // Add click handler
        iconDiv.addEventListener('click', () => selectProfileIcon(icon.id, icon.color, iconDiv));
        
        profileIconsGrid.appendChild(iconDiv);
    });
}

// Handle profile icon selection
function selectProfileIcon(iconId, iconColor, iconElement) {
    // Update selected state in UI
    document.querySelectorAll('.profile-icon-option').forEach(option => {
        option.classList.remove('selected');
    });
    iconElement.classList.add('selected');
    
    // Update preview
    const profileIconPreview = document.getElementById('currentProfileIcon');
    profileIconPreview.innerHTML = '';
    profileIconPreview.style.backgroundColor = iconColor;
    
    // Store selection for form submission
    selectedProfileIcon = iconId;
}

// Load user preferences
function loadUserPreferences() {
    // No longer needed since we removed the preferences tab
    // Just keeping an empty function in case it's called elsewhere
    return;
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
        
        const updateData = {
            firstName,
            lastName,
            phoneNumber,
            updatedAt: new Date().toISOString()
        };
        
        // Add profileIcon if selected
        if (selectedProfileIcon) {
            updateData.profileIcon = selectedProfileIcon;
        }
        
        await updateDoc(userRef, updateData);
        
        // Update local user data
        userData.firstName = firstName;
        userData.lastName = lastName;
        userData.phoneNumber = phoneNumber;
        if (selectedProfileIcon) {
            userData.profileIcon = selectedProfileIcon;
        }
        
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

// Handle account deletion
async function handleDeleteAccount(e) {
    e.preventDefault();
    
    const password = document.getElementById('delete-confirm-password').value;
    const confirmDelete = document.getElementById('confirm-delete').checked;
    
    if (!confirmDelete) {
        showNotification('You must confirm that you understand the consequences of deleting your account', 'error');
        return;
    }
    
    if (!password) {
        showNotification('Please enter your password to confirm account deletion', 'error');
        return;
    }
    
    // Confirm with a dialog
    if (!confirm('Are you absolutely sure you want to delete your account? This action CANNOT be undone.')) {
        return;
    }
    
    try {
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(
            currentUser.email,
            password
        );
        
        await reauthenticateWithCredential(currentUser, credential);
        
        // Delete user data from Firestore first
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await deleteDoc(userRef);
            console.log('User document deleted from Firestore');
        } catch (deleteDocError) {
            console.error('Error deleting user document:', deleteDocError);
            // Continue with account deletion even if document deletion fails
        }
        
        // Delete user account from Firebase Auth
        await deleteUser(currentUser);
        
        // Show success notification
        showNotification('Your account has been permanently deleted', 'success');
        
        // Redirect to home page after a short delay
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    } catch (error) {
        console.error('Error deleting account:', error);
        
        if (error.code === 'auth/wrong-password') {
            showNotification('Incorrect password. Please try again.', 'error');
        } else {
            showNotification('Error deleting account: ' + error.message, 'error');
        }
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
    // Admin dropdown (reusing existing behavior)
    if (adminDropdownBtn) {
        adminDropdownBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            document.getElementById('adminDropdownContent').classList.toggle('show-dropdown');
            this.classList.toggle('active');
        });
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.matches('.admin-dropdown-btn')) {
            const dropdowns = document.querySelectorAll('.admin-dropdown-content');
            dropdowns.forEach(dropdown => {
                if (dropdown.classList.contains('show-dropdown')) {
                    dropdown.classList.remove('show-dropdown');
                    
                    // Also remove active class from buttons
                    if (adminDropdownBtn) adminDropdownBtn.classList.remove('active');
                }
            });
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

// Update user account link with icon
function updateUserAccountLinkWithIcon() {
    if (!userAccountLink || !userData) return;
    
    // Create icon span
    const iconSpan = document.createElement('span');
    iconSpan.className = 'user-icon-small';
    
    // Check if user has a profile icon
    if (userData.profileIcon) {
        const icon = PROFILE_ICONS.find(icon => icon.id === userData.profileIcon);
        if (icon) {
            iconSpan.style.backgroundColor = icon.color;
        } else {
            // Fallback to initial
            const initial = userData.firstName ? 
                userData.firstName.charAt(0).toUpperCase() : 
                currentUser.email.charAt(0).toUpperCase();
            iconSpan.textContent = initial;
        }
    } else {
        // Use initial as fallback
        const initial = userData.firstName ? 
            userData.firstName.charAt(0).toUpperCase() : 
            currentUser.email.charAt(0).toUpperCase();
        iconSpan.textContent = initial;
    }
    
    // Create display name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'user-name';
    nameSpan.textContent = userData.firstName || 'My Account';
    
    // Clear existing content and add new elements
    userAccountLink.innerHTML = '';
    userAccountLink.appendChild(iconSpan);
    userAccountLink.appendChild(nameSpan);
}

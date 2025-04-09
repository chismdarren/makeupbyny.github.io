import { auth, db, isSuperAdmin } from './firebase-config.js';
import { 
    onAuthStateChanged,
    signOut, 
    updatePassword, 
    reauthenticateWithCredential, 
    EmailAuthProvider 
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import { 
    doc, 
    getDoc, 
    updateDoc 
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// DOM elements
const notificationEl = document.getElementById('notification');
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Form elements
const profileForm = document.getElementById('profile-form');
const passwordForm = document.getElementById('password-form');
const preferencesForm = document.getElementById('preferences-form');

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
    
    // Initially hide user account link until auth check completes
    if (userAccountLink) userAccountLink.style.display = 'none';
    
    // Set up tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    
    // Set up form submissions
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);
    if (passwordForm) passwordForm.addEventListener('submit', handlePasswordUpdate);
    if (preferencesForm) preferencesForm.addEventListener('submit', handlePreferencesUpdate);
    
    // Set up cancel buttons
    document.getElementById('profile-cancel').addEventListener('click', () => loadUserData());
    document.getElementById('password-cancel').addEventListener('click', () => passwordForm.reset());
    document.getElementById('preferences-cancel').addEventListener('click', () => loadUserPreferences());
    
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
    
    // Show admin dropdown based on role
    const isAdmin = isSuperAdmin(currentUser.uid) || (userData && userData.isAdmin);
    if (adminDropdownBtn) adminDropdownBtn.style.display = isAdmin ? 'inline' : 'none';
    
    // Show settings icon when user is logged in
    const settingsIcon = document.getElementById('settingsIcon');
    if (settingsIcon) settingsIcon.style.display = 'flex';
    
    // Load user data
    await loadUserData();
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
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        showNotification('Error loading user data: ' + error.message, 'error');
    }
}

// Load user preferences
function loadUserPreferences() {
    if (userData && userData.preferences) {
        document.getElementById('emailNotifications').checked = userData.preferences.emailNotifications || false;
        document.getElementById('marketingEmails').checked = userData.preferences.marketingEmails || false;
    } else {
        document.getElementById('emailNotifications').checked = false;
        document.getElementById('marketingEmails').checked = false;
    }
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

// Handle preferences form submission
async function handlePreferencesUpdate(e) {
    e.preventDefault();
    
    const emailNotifications = document.getElementById('emailNotifications').checked;
    const marketingEmails = document.getElementById('marketingEmails').checked;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        
        await updateDoc(userRef, {
            'preferences.emailNotifications': emailNotifications,
            'preferences.marketingEmails': marketingEmails,
            updatedAt: new Date().toISOString()
        });
        
        // Update local user data
        if (!userData.preferences) userData.preferences = {};
        userData.preferences.emailNotifications = emailNotifications;
        userData.preferences.marketingEmails = marketingEmails;
        
        showNotification('Preferences updated successfully', 'success');
    } catch (error) {
        console.error('Error updating preferences:', error);
        showNotification('Error updating preferences: ' + error.message, 'error');
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

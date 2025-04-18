// Firebase Connection Handler
// This module helps monitor and recover from Firestore connection issues

import { 
    enableIndexedDbPersistence, 
    disableNetwork, 
    enableNetwork 
} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';

// Track connection state
let isConnected = true;
let connectionAttempts = 0;
const maxReconnectionAttempts = 3;
let reconnectionTimer = null;

/**
 * Initialize Firebase connection monitoring
 * @param {Object} db - Firestore database instance
 */
export function initializeConnectionMonitoring(db) {
    console.log('Initializing Firestore connection monitoring');
    
    // Enable offline persistence for better offline experience
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Firebase persistence unavailable: multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.warn('Firebase persistence unavailable: browser not supported');
        } else {
            console.warn('Firebase persistence error:', err);
        }
    });

    // Set up online/offline detection
    setupNetworkListeners(db);
    
    // Handle blocked client errors
    setupErrorListeners(db);
    
    // Return control functions
    return {
        checkConnection: () => isConnected,
        forceReconnect: () => forceReconnection(db)
    };
}

/**
 * Setup network state listeners
 */
function setupNetworkListeners(db) {
    // Browser online/offline events
    window.addEventListener('online', () => {
        console.log('Browser is online, enabling Firestore network');
        isConnected = true;
        enableNetwork(db).then(() => {
            console.log('Firestore network enabled');
        }).catch(error => {
            console.error('Error enabling Firestore network:', error);
        });
    });
    
    window.addEventListener('offline', () => {
        console.log('Browser is offline, disabling Firestore network');
        isConnected = false;
        disableNetwork(db).then(() => {
            console.log('Firestore network disabled');
        }).catch(error => {
            console.error('Error disabling Firestore network:', error);
        });
    });
}

/**
 * Setup error event listeners to catch Firestore connection issues
 */
function setupErrorListeners(db) {
    // Use global error event to catch network errors
    window.addEventListener('error', (event) => {
        // Check if this is a Firestore connection error
        if (typeof event.message === 'string' && 
            (event.message.includes('ERR_BLOCKED_BY_CLIENT') || 
             event.message.includes('fetching')) && 
            event.filename && 
            (event.filename.includes('firestore') || event.filename.includes('firebase'))) {
            
            console.warn('Detected Firestore connection issue:', event.message);
            handleConnectionError(db);
        }
    });
    
    // Also listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && 
            typeof event.reason.message === 'string' && 
            (event.reason.message.includes('ERR_BLOCKED_BY_CLIENT') || 
             event.reason.message.includes('fetching') ||
             event.reason.message.includes('network'))) {
            
            console.warn('Detected Firestore promise rejection:', event.reason.message);
            handleConnectionError(db);
        }
    });
}

/**
 * Handle Firestore connection errors with exponential backoff
 */
function handleConnectionError(db) {
    connectionAttempts++;
    
    // Clear any existing reconnection timer
    if (reconnectionTimer) {
        clearTimeout(reconnectionTimer);
    }
    
    console.log(`Firestore connection attempt ${connectionAttempts}/${maxReconnectionAttempts}`);
    
    if (connectionAttempts <= maxReconnectionAttempts) {
        // Exponential backoff (3s, 9s, 27s)
        const backoffTime = Math.pow(3, connectionAttempts) * 1000;
        console.log(`Attempting to reconnect in ${backoffTime/1000} seconds...`);
        
        // Create a UI notification if this is the first error
        if (connectionAttempts === 1) {
            showConnectionNotification('Reconnecting to server...', false);
        }
        
        reconnectionTimer = setTimeout(() => {
            forceReconnection(db);
        }, backoffTime);
    } else {
        console.warn('Maximum reconnection attempts reached');
        showConnectionNotification('Connection issues detected. Some features may be limited.', true);
        
        // Reset counter after a longer period to try again
        reconnectionTimer = setTimeout(() => {
            connectionAttempts = 0;
            forceReconnection(db);
        }, 60000); // Try again after 1 minute
    }
}

/**
 * Force Firestore to reconnect by temporarily disabling and then re-enabling the network
 */
function forceReconnection(db) {
    console.log('Forcing Firestore reconnection...');
    
    disableNetwork(db)
        .then(() => {
            console.log('Network disabled, re-enabling...');
            return new Promise(resolve => setTimeout(resolve, 1000));
        })
        .then(() => enableNetwork(db))
        .then(() => {
            console.log('Firestore reconnection successful');
            isConnected = true;
            // Reset connection attempts on success
            connectionAttempts = 0;
            showConnectionNotification('Connection restored', false, true);
        })
        .catch(error => {
            console.error('Error during Firestore reconnection:', error);
            // Don't increment connectionAttempts here as handleConnectionError will catch this
        });
}

/**
 * Show a connection status notification to the user
 */
function showConnectionNotification(message, isPersistent = false, autoHide = false) {
    // Create or get notification element
    let notificationEl = document.getElementById('connection-notification');
    
    if (!notificationEl) {
        notificationEl = document.createElement('div');
        notificationEl.id = 'connection-notification';
        
        // Style the notification
        Object.assign(notificationEl.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '10px 15px',
            borderRadius: '4px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            zIndex: '9999',
            fontSize: '14px',
            transition: 'opacity 0.3s ease',
            opacity: '0'
        });
        
        document.body.appendChild(notificationEl);
        
        // Fade in
        setTimeout(() => {
            notificationEl.style.opacity = '1';
        }, 10);
    }
    
    // Update message
    notificationEl.textContent = message;
    
    // Change style for success message
    if (message.includes('restored')) {
        notificationEl.style.backgroundColor = '#d4edda';
        notificationEl.style.color = '#155724';
    } else {
        notificationEl.style.backgroundColor = '#f8d7da';
        notificationEl.style.color = '#721c24';
    }
    
    // Auto-hide non-persistent notifications
    if (!isPersistent || autoHide) {
        setTimeout(() => {
            notificationEl.style.opacity = '0';
            setTimeout(() => {
                if (notificationEl.parentNode) {
                    notificationEl.parentNode.removeChild(notificationEl);
                }
            }, 300);
        }, 5000);
    }
}

// Export functions
export { enableNetwork, disableNetwork }; 
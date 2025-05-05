import { db, auth, isAdminUser } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

// DOM elements
const adminDropdownBtn = document.getElementById("adminDropdownBtn");
const userAccountLink = document.getElementById("userAccountLink");
const loginLink = document.getElementById("login-link");
const logoutBtn = document.getElementById("logout-btn");
const settingsIcon = document.getElementById("settingsIcon");

document.addEventListener('DOMContentLoaded', () => {
  // Initially hide user account link and settings icon until auth check completes
  if (userAccountLink) userAccountLink.style.display = "none";
  if (settingsIcon) settingsIcon.style.display = "none";
  
  // Setup dropdowns
  setupDropdowns();
  
  // Setup logout button
  setupLogout();
  
  // Handle authentication state
  onAuthStateChanged(auth, handleAuthStateChange);
});

// Handle authentication state changes
async function handleAuthStateChange(user) {
  if (user) {
    console.log("User is logged in:", user.email);
    
    // Update UI based on user role
    if (loginLink) loginLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline";
    if (userAccountLink) userAccountLink.style.display = "inline";
    
    // Show admin dropdown based on role
    const isAdmin = await isAdminUser(user.uid);
    if (adminDropdownBtn) adminDropdownBtn.style.display = isAdmin ? "inline" : "none";
    
    // Show settings icon when user is logged in
    if (settingsIcon) settingsIcon.style.display = "flex";
    
    if (isAdmin) {
      // Load contact messages
      loadContactMessages();
    } else {
      // User is not admin, redirect to home
      alert('Access denied. Admin privileges required.');
      window.location.href = 'index.html';
    }
  } else {
    console.log("User is not logged in");
    
    // Update UI for logged out state
    if (loginLink) loginLink.style.display = "inline";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userAccountLink) userAccountLink.style.display = "none";
    if (adminDropdownBtn) adminDropdownBtn.style.display = "none";
    if (settingsIcon) settingsIcon.style.display = "none";
    
    // Not logged in, redirect to login page
    window.location.href = 'login.html';
  }
}

// Set up dropdowns
function setupDropdowns() {
  // Admin dropdown
  if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById("adminDropdownContent").classList.toggle("show-dropdown");
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
    logoutBtn.addEventListener("click", handleLogout);
  }
}

// Handle logout
function handleLogout() {
  signOut(auth).then(() => {
    console.log("User signed out");
    window.location.href = "index.html";
  }).catch(error => {
    console.error("Error signing out:", error);
  });
}

// Load and display contact messages
function loadContactMessages() {
  const messagesContainer = document.getElementById('messagesContainer');
  if (!messagesContainer) return;

  // Add message count and controls at the top
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'messages-controls';
  controlsDiv.style.display = 'flex';
  controlsDiv.style.justifyContent = 'space-between';
  controlsDiv.style.alignItems = 'center';
  controlsDiv.style.marginBottom = '20px';
  controlsDiv.style.padding = '10px';
  controlsDiv.style.backgroundColor = '#f9f9f9';
  controlsDiv.style.borderRadius = '4px';
  
  controlsDiv.innerHTML = `
    <div class="message-count">
      <span id="totalMessages">0 messages</span>
      <span id="unreadCount" style="margin-left: 10px; background-color: #4CAF50; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">0 new</span>
    </div>
    <div class="message-filters">
      <select id="statusFilter" style="padding: 5px; border-radius: 4px; border: 1px solid #ddd;">
        <option value="all">All Messages</option>
        <option value="new">New</option>
        <option value="read">Read</option>
      </select>
    </div>
  `;
  
  // Insert controls before messages
  const messagesSection = messagesContainer.parentElement;
  messagesSection.insertBefore(controlsDiv, messagesContainer);
  
  // Add event listener to status filter
  const statusFilter = document.getElementById('statusFilter');
  statusFilter.addEventListener('change', function() {
    const selectedStatus = this.value;
    
    // Show all messages or filter by status
    const messageCards = document.querySelectorAll('.message-card');
    messageCards.forEach(card => {
      if (selectedStatus === 'all' || card.classList.contains(selectedStatus)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  });

  // Set up modal close event
  const modal = document.getElementById('messageModal');
  const closeBtn = document.querySelector('.message-modal-close');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Create a query to get all messages ordered by timestamp
  const q = query(collection(db, 'contact_messages'), orderBy('timestamp', 'desc'));

  // Listen for real-time updates
  onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = ''; // Clear existing messages
    
    if (snapshot.empty) {
      messagesContainer.innerHTML = '<p style="text-align: center; padding: 20px;">No messages found.</p>';
      document.getElementById('totalMessages').textContent = '0 messages';
      document.getElementById('unreadCount').textContent = '0 new';
      document.getElementById('unreadCount').style.display = 'none';
      return;
    }

    let totalMessages = 0;
    let unreadMessages = 0;
    
    snapshot.forEach((doc) => {
      const message = doc.data();
      totalMessages++;
      if (message.status === 'new') {
        unreadMessages++;
      }
      
      const messageElement = createMessageElement(doc.id, message);
      messagesContainer.appendChild(messageElement);
    });
    
    // Update message count display
    document.getElementById('totalMessages').textContent = `${totalMessages} message${totalMessages !== 1 ? 's' : ''}`;
    document.getElementById('unreadCount').textContent = `${unreadMessages} new`;
    document.getElementById('unreadCount').style.display = unreadMessages > 0 ? 'inline' : 'none';
  });
}

// Create HTML element for a message
function createMessageElement(id, message) {
  const div = document.createElement('div');
  div.className = `message-card ${message.status || 'new'}`;
  div.dataset.id = id;
  
  // Format the timestamp
  let timestampDisplay = 'Unknown date';
  if (message.timestamp) {
    if (message.timestamp instanceof Timestamp) {
      timestampDisplay = message.timestamp.toDate().toLocaleString();
    } else {
      // Handle if timestamp is already a Date or string
      const date = new Date(message.timestamp);
      if (!isNaN(date)) {
        timestampDisplay = date.toLocaleString();
      }
    }
  }
  
  // Create a truncated message preview (first 50 characters)
  const messagePreview = (message.message || 'No message content').slice(0, 50) + 
    ((message.message && message.message.length > 50) ? '...' : '');
  
  div.innerHTML = `
    <div class="message-header">
      <h3>${message.name || 'Unknown'}</h3>
      <span class="timestamp">${timestampDisplay}</span>
    </div>
    <div class="message-preview">${messagePreview}</div>
  `;

  // Add click event to open modal
  div.addEventListener('click', (e) => {
    // Don't open modal if user is clicking on controls
    if (e.target.classList.contains('status-select') || 
        e.target.classList.contains('delete-btn')) {
      return;
    }
    
    showMessageDetails(id, message);
  });
  
  return div;
}

// Function to show message details in modal
function showMessageDetails(id, message) {
  const modal = document.getElementById('messageModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  const modalActions = document.getElementById('modalActions');
  
  // Format the timestamp
  let timestampDisplay = 'Unknown date';
  if (message.timestamp) {
    if (message.timestamp instanceof Timestamp) {
      timestampDisplay = message.timestamp.toDate().toLocaleString();
    } else {
      // Handle if timestamp is already a Date or string
      const date = new Date(message.timestamp);
      if (!isNaN(date)) {
        timestampDisplay = date.toLocaleString();
      }
    }
  }
  
  // Update modal title
  modalTitle.textContent = message.subject || 'Message from ' + (message.name || 'Unknown');
  
  // Update modal content
  modalContent.innerHTML = `
    <div>
      <p><strong>From:</strong> ${message.name || 'Unknown'}</p>
      <p><strong>Email:</strong> <a href="mailto:${message.email || ''}" style="color: #222; text-decoration: underline;">${message.email || 'No email provided'}</a></p>
      <p><strong>Phone:</strong> <a href="tel:${message.phone || ''}" style="color: #222; text-decoration: underline;">${message.phone || 'No phone provided'}</a></p>
      <p><strong>Preferred Contact Method:</strong> ${message.contactPreference || 'Not specified'}</p>
      <p><strong>Time:</strong> ${timestampDisplay}</p>
      <div class="message-full-content">
        <p><strong>Message:</strong></p>
        <div style="background-color: #f9f9f9; padding: 10px; border-radius: 4px; margin-top: 5px;">
          ${message.message || 'No message content'}
        </div>
      </div>
    </div>
  `;
  
  // Update modal actions
  modalActions.innerHTML = `
    <select class="status-select" data-id="${id}">
      <option value="new" ${message.status === 'new' ? 'selected' : ''}>New</option>
      <option value="read" ${message.status === 'read' ? 'selected' : ''}>Read</option>
    </select>
    <button class="delete-btn" data-id="${id}">Delete</button>
  `;
  
  // Add event listeners to action buttons
  const statusSelect = modalActions.querySelector('.status-select');
  statusSelect.addEventListener('change', (e) => {
    updateMessageStatus(id, e.target.value);
    
    // Also update the status class on the message card
    const messageCard = document.querySelector(`.message-card[data-id="${id}"]`);
    if (messageCard) {
      messageCard.className = `message-card ${e.target.value}`;
    }
  });
  
  const deleteBtn = modalActions.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    deleteMessage(id);
  });
  
  // If message was new, mark it as read
  if (message.status === 'new') {
    updateMessageStatus(id, 'read');
    
    // Update the message card status class without waiting for Firestore
    const messageCard = document.querySelector(`.message-card[data-id="${id}"]`);
    if (messageCard) {
      messageCard.className = 'message-card read';
    }
  }
  
  // Show modal
  modal.style.display = 'block';
}

// Update message status
async function updateMessageStatus(id, status) {
  try {
    const messageRef = doc(db, 'contact_messages', id);
    await updateDoc(messageRef, { status });
  } catch (error) {
    console.error('Error updating message status:', error);
    alert('Failed to update message status. Please try again.');
  }
}

// Delete message
async function deleteMessage(id) {
  if (!confirm('Are you sure you want to delete this message?')) return;

  try {
    const messageRef = doc(db, 'contact_messages', id);
    await deleteDoc(messageRef);
  } catch (error) {
    console.error('Error deleting message:', error);
    alert('Failed to delete message. Please try again.');
  }
}
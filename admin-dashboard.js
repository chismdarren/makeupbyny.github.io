import { db, auth } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

// Hardcoded admin UID
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const adminDropdownBtn = document.getElementById('adminDropdownBtn');
  const loginLink = document.getElementById('login-link');
  const logoutBtn = document.getElementById('logout-btn');

  // Handle authentication state
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      // Not logged in, redirect to login page
      window.location.href = 'login.html';
      return;
    }

    // User is logged in
    if (loginLink) loginLink.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline';

    // Check if user is admin
    if (user.uid === adminUID) {
      // User is admin, show admin dropdown menu
      if (adminDropdownBtn) adminDropdownBtn.style.display = 'inline';
      
      // Load contact messages
      loadContactMessages();
    } else {
      // User is not admin, redirect to home
      alert('Access denied. Admin privileges required.');
      window.location.href = 'index.html';
    }
  });

  // Handle admin dropdown toggle
  if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      document.getElementById('adminDropdownContent').classList.toggle('show-dropdown');
      this.classList.toggle('active');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.matches('#adminDropdownBtn') && !e.target.matches('.dropdown-icon')) {
        const dropdown = document.getElementById('adminDropdownContent');
        const btn = document.getElementById('adminDropdownBtn');
        if (dropdown && dropdown.classList.contains('show-dropdown')) {
          dropdown.classList.remove('show-dropdown');
          btn.classList.remove('active');
        }
      }
    });
  }

  // Handle logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        window.location.href = 'index.html';
      } catch (error) {
        console.error('Error signing out:', error);
      }
    });
  }
});

// Load and display contact messages
function loadContactMessages() {
  const messagesContainer = document.getElementById('messagesContainer');
  if (!messagesContainer) return;

  // Create a query to get all messages ordered by timestamp
  const q = query(collection(db, 'contact_messages'), orderBy('timestamp', 'desc'));

  // Listen for real-time updates
  onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = ''; // Clear existing messages
    
    if (snapshot.empty) {
      messagesContainer.innerHTML = '<p>No messages found.</p>';
      return;
    }

    snapshot.forEach((doc) => {
      const message = doc.data();
      const messageElement = createMessageElement(doc.id, message);
      messagesContainer.appendChild(messageElement);
    });
  });
}

// Create HTML element for a message
function createMessageElement(id, message) {
  const div = document.createElement('div');
  div.className = `message-card ${message.status || 'new'}`;
  
  const timestamp = message.timestamp ? message.timestamp.toDate().toLocaleString() : 'Unknown date';
  
  div.innerHTML = `
    <div class="message-header">
      <h3>${message.subject || 'No Subject'}</h3>
      <span class="timestamp">${timestamp}</span>
    </div>
    <div class="message-content">
      <p><strong>From:</strong> ${message.name || 'Unknown'}</p>
      <p><strong>Email:</strong> ${message.email || 'No email provided'}</p>
      <p><strong>Message:</strong></p>
      <p>${message.message || 'No message content'}</p>
    </div>
    <div class="message-actions">
      <select class="status-select" data-id="${id}">
        <option value="new" ${message.status === 'new' ? 'selected' : ''}>New</option>
        <option value="read" ${message.status === 'read' ? 'selected' : ''}>Read</option>
        <option value="replied" ${message.status === 'replied' ? 'selected' : ''}>Replied</option>
      </select>
      <button class="delete-btn" data-id="${id}">Delete</button>
    </div>
  `;

  // Add event listeners
  const statusSelect = div.querySelector('.status-select');
  statusSelect.addEventListener('change', (e) => updateMessageStatus(id, e.target.value));

  const deleteBtn = div.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', () => deleteMessage(id));

  return div;
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
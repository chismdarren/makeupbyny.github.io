import { db, auth } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
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
        <option value="replied">Replied</option>
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
  
  div.innerHTML = `
    <div class="message-header">
      <h3>${message.subject || 'No Subject'}</h3>
      <span class="timestamp">${timestampDisplay}</span>
    </div>
    <div class="message-content">
      <p><strong>From:</strong> ${message.name || 'Unknown'}</p>
      <p><strong>Email:</strong> <a href="mailto:${message.email || ''}" style="color: #222; text-decoration: underline;">${message.email || 'No email provided'}</a></p>
      <p><strong>Message:</strong></p>
      <div style="background-color: #f9f9f9; padding: 10px; border-radius: 4px; margin-top: 5px;">${message.message || 'No message content'}</div>
    </div>
    <div class="message-actions">
      <select class="status-select" data-id="${id}">
        <option value="new" ${message.status === 'new' ? 'selected' : ''}>New</option>
        <option value="read" ${message.status === 'read' ? 'selected' : ''}>Read</option>
        <option value="replied" ${message.status === 'replied' ? 'selected' : ''}>Replied</option>
      </select>
      <button class="reply-btn" style="margin: 0 10px; padding: 5px 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="window.location.href='mailto:${message.email || ''}'">Reply</button>
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
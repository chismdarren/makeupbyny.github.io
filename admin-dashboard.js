import { db, auth, isAdminUser } from './firebase-config.js';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';

document.addEventListener('DOMContentLoaded', () => {
  // Handle authentication state
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Not logged in, redirect to login page
      window.location.href = 'login.html';
      return;
    }

    // Check if user is admin
    const isAdmin = await isAdminUser(user.uid);
    if (isAdmin) {
      // User is admin, load contact messages
      loadContactMessages();
    } else {
      // User is not admin, redirect to home
      alert('Access denied. Admin privileges required.');
      window.location.href = 'index.html';
    }
  });
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

  // Query messages from Firestore
  const messagesQuery = query(
    collection(db, 'contactMessages'),
    orderBy('timestamp', 'desc')
  );

  // Listen for real-time updates
  onSnapshot(messagesQuery, (snapshot) => {
    // Clear existing messages, but keep the controls
    messagesContainer.innerHTML = '';
    
    // Count total and unread messages
    let totalMessages = snapshot.size;
    let unreadMessages = 0;
    
    // No messages case
    if (totalMessages === 0) {
      messagesContainer.innerHTML = '<p>No messages yet.</p>';
      document.getElementById('totalMessages').textContent = '0 messages';
      document.getElementById('unreadCount').textContent = '0 new';
      return;
    }
    
    // Process messages
    snapshot.forEach((doc) => {
      const messageData = doc.data();
      const messageId = doc.id;
      
      // Check if message is unread (new)
      if (messageData.status === 'new') {
        unreadMessages++;
      }
      
      // Create and append message element
      const messageElement = createMessageElement(messageId, messageData);
      messagesContainer.appendChild(messageElement);
    });
    
    // Update message counts
    document.getElementById('totalMessages').textContent = `${totalMessages} message${totalMessages !== 1 ? 's' : ''}`;
    document.getElementById('unreadCount').textContent = `${unreadMessages} new`;
    
    // Setup modal event handlers after messages are loaded
    setupModalHandlers();
  });
}

// Create HTML element for a message card
function createMessageElement(id, message) {
  const messageElement = document.createElement('div');
  messageElement.className = `message-card ${message.status || 'new'}`;
  messageElement.dataset.id = id;
  
  // Format timestamp
  const timestamp = message.timestamp ? new Date(message.timestamp.seconds * 1000) : new Date();
  const formattedDate = timestamp.toLocaleDateString();
  const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Create message content
  messageElement.innerHTML = `
    <div class="message-header">
      <h3>${message.name || 'Unknown Sender'}</h3>
      <span class="timestamp">${formattedDate} at ${formattedTime}</span>
    </div>
    <div class="message-preview">${message.message || 'No message content'}</div>
    <div class="message-actions">
      <select class="status-select" data-id="${id}">
        <option value="new" ${message.status === 'new' ? 'selected' : ''}>New</option>
        <option value="read" ${message.status === 'read' ? 'selected' : ''}>Read</option>
      </select>
      <button class="delete-btn" data-id="${id}">Delete</button>
    </div>
  `;
  
  // Add click event to view message details
  messageElement.addEventListener('click', (e) => {
    // Don't trigger when clicking on actions
    if (e.target.closest('.message-actions')) return;
    
    showMessageDetails(id, message);
  });
  
  // Add event handlers for actions
  const statusSelect = messageElement.querySelector('.status-select');
  statusSelect.addEventListener('change', (e) => {
    e.stopPropagation();
    updateMessageStatus(id, e.target.value);
  });
  
  const deleteBtn = messageElement.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this message?')) {
      deleteMessage(id);
    }
  });
  
  return messageElement;
}

// Show message details in modal
function showMessageDetails(id, message) {
  const modal = document.getElementById('messageModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  const modalActions = document.getElementById('modalActions');
  
  // Format timestamp
  const timestamp = message.timestamp ? new Date(message.timestamp.seconds * 1000) : new Date();
  const formattedDate = timestamp.toLocaleDateString();
  const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Set modal title
  modalTitle.textContent = `Message from ${message.name || 'Unknown Sender'}`;
  
  // Set modal content
  modalContent.innerHTML = `
    <p><strong>Date:</strong> ${formattedDate} at ${formattedTime}</p>
    <p><strong>Email:</strong> ${message.email || 'No email provided'}</p>
    <p><strong>Phone:</strong> ${message.phone || 'No phone provided'}</p>
    <div class="message-full-content">
      <strong>Message:</strong>
      <p>${message.message || 'No message content'}</p>
    </div>
  `;
  
  // Set modal actions
  modalActions.innerHTML = `
    <select id="modalStatusSelect" class="status-select">
      <option value="new" ${message.status === 'new' ? 'selected' : ''}>New</option>
      <option value="read" ${message.status === 'read' ? 'selected' : ''}>Read</option>
    </select>
    <button id="modalDeleteBtn" class="delete-btn">Delete</button>
  `;
  
  // Add event listeners to modal actions
  const modalStatusSelect = document.getElementById('modalStatusSelect');
  modalStatusSelect.addEventListener('change', () => {
    updateMessageStatus(id, modalStatusSelect.value);
  });
  
  const modalDeleteBtn = document.getElementById('modalDeleteBtn');
  modalDeleteBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete this message?')) {
      deleteMessage(id);
      closeModal();
    }
  });
  
  // Mark message as read when viewed (if it's new)
  if (message.status === 'new') {
    updateMessageStatus(id, 'read');
    // Update the card status without reloading
    const card = document.querySelector(`.message-card[data-id="${id}"]`);
    if (card) {
      card.classList.remove('new');
      card.classList.add('read');
      const statusSelect = card.querySelector('.status-select');
      if (statusSelect) statusSelect.value = 'read';
    }
  }
  
  // Show modal
  modal.style.display = 'block';
}

// Setup modal event handlers
function setupModalHandlers() {
  const modal = document.getElementById('messageModal');
  const closeBtn = document.querySelector('.message-modal-close');
  
  // Close modal when clicking X button
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
  
  // Close modal when clicking outside the modal content
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  
  // Close modal when pressing Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      closeModal();
    }
  });
}

// Close the modal
function closeModal() {
  const modal = document.getElementById('messageModal');
  modal.style.display = 'none';
}

// Update message status
async function updateMessageStatus(id, status) {
  try {
    await updateDoc(doc(db, 'contactMessages', id), {
      status: status
    });
  } catch (error) {
    console.error('Error updating message status:', error);
  }
}

// Delete message
async function deleteMessage(id) {
  try {
    await deleteDoc(doc(db, 'contactMessages', id));
  } catch (error) {
    console.error('Error deleting message:', error);
  }
}
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDxQqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq",
  authDomain: "makeupbyny.firebaseapp.com",
  projectId: "makeupbyny",
  storageBucket: "gs://makeupbyny-1.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication state
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      // Redirect to login if not authenticated
      window.location.href = 'login.html';
      return;
    }
    
    // Load contact messages
    loadContactMessages();
  });
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
  div.className = `message-card ${message.status}`;
  div.innerHTML = `
    <div class="message-header">
      <h3>${message.subject}</h3>
      <span class="timestamp">${message.timestamp.toDate().toLocaleString()}</span>
    </div>
    <div class="message-content">
      <p><strong>From:</strong> ${message.name}</p>
      <p><strong>Email:</strong> ${message.email}</p>
      <p><strong>Message:</strong></p>
      <p>${message.message}</p>
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

// Handle logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await auth.signOut();
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  });
} 
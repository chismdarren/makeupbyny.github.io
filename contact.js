import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
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

// Handle contact form submission
document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.getElementById('contactForm');
  
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Get form values
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const subject = document.getElementById('subject').value;
      const message = document.getElementById('message').value;
      
      try {
        // Add the contact form submission to Firestore
        await addDoc(collection(db, 'contact_messages'), {
          name,
          email,
          subject,
          message,
          timestamp: new Date(),
          status: 'new'
        });
        
        // Show success message
        alert('Thank you for your message! I will get back to you soon.');
        
        // Clear the form
        contactForm.reset();
      } catch (error) {
        console.error('Error submitting contact form:', error);
        alert('Sorry, there was an error sending your message. Please try again later.');
      }
    });
  }
  
  // Handle authentication state
  onAuthStateChanged(auth, (user) => {
    const adminDashboard = document.getElementById('adminDashboard');
    const createPost = document.getElementById('createPost');
    const manageUsers = document.getElementById('manageUsers');
    const loginLink = document.getElementById('login-link');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (user) {
      // User is signed in
      adminDashboard.style.display = 'inline-block';
      createPost.style.display = 'inline-block';
      manageUsers.style.display = 'inline-block';
      loginLink.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
    } else {
      // User is signed out
      adminDashboard.style.display = 'none';
      createPost.style.display = 'none';
      manageUsers.style.display = 'none';
      loginLink.style.display = 'inline-block';
      logoutBtn.style.display = 'none';
    }
  });
  
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
}); 
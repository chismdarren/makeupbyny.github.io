import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Import from firebase-config.js instead of defining config here
import { auth, db } from './firebase-config.js';

// Define admin user ID - correct ID from other pages
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

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
    const adminDropdownBtn = document.getElementById('adminDropdownBtn');
    const loginLink = document.getElementById('login-link');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (user) {
      // User is signed in
      loginLink.style.display = 'none';
      logoutBtn.style.display = 'inline';
      
      // Check if user is admin
      if (user.uid === adminUID) {
        // Show admin dropdown button
        adminDropdownBtn.style.display = 'inline';
      } else {
        // Hide admin dropdown button for regular users
        adminDropdownBtn.style.display = 'none';
      }
    } else {
      // User is signed out
      loginLink.style.display = 'inline';
      logoutBtn.style.display = 'none';
      adminDropdownBtn.style.display = 'none';
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
  
  // Toggle dropdown menu on click
  const adminDropdownBtn = document.getElementById('adminDropdownBtn');
  if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener('click', function(e) {
      e.preventDefault(); // Prevent default link behavior
      this.classList.toggle('active');
      document.getElementById('adminDropdownContent').classList.toggle('show-dropdown');
    });
  }

  // Close dropdown when clicking outside
  window.addEventListener('click', function(e) {
    if (!e.target.matches('#adminDropdownBtn') && !e.target.matches('.dropdown-icon')) {
      const dropdown = document.getElementById('adminDropdownContent');
      const btn = document.getElementById('adminDropdownBtn');
      if (dropdown && dropdown.classList.contains('show-dropdown')) {
        dropdown.classList.remove('show-dropdown');
        btn.classList.remove('active');
      }
    }
  });
}); 
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Import from firebase-config.js instead of defining config here
import { auth, db } from './firebase-config.js';

// Define admin user ID - correct ID from other pages
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Handle contact form submission
document.addEventListener('DOMContentLoaded', () => {
  const contactForm = document.getElementById('contactForm');
  
  if (contactForm) {
    // Create a feedback element
    const feedbackElement = document.createElement('div');
    feedbackElement.id = 'form-feedback';
    feedbackElement.style.padding = '15px';
    feedbackElement.style.margin = '15px 0';
    feedbackElement.style.borderRadius = '4px';
    feedbackElement.style.display = 'none';
    
    // Insert the feedback element after the form
    contactForm.parentNode.insertBefore(feedbackElement, contactForm.nextSibling);
    
    // Add submit event listener to the form
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Disable form during submission
      const submitButton = contactForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
      
      // Get form values
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const subject = document.getElementById('subject').value.trim();
      const message = document.getElementById('message').value.trim();
      
      // Simple client-side validation
      if (!name || !email || !subject || !message) {
        showFeedback('Please fill in all fields.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        return;
      }
      
      try {
        // Add the contact form submission to Firestore
        await addDoc(collection(db, 'contact_messages'), {
          name,
          email,
          subject,
          message,
          timestamp: serverTimestamp(), // Use server timestamp for consistency
          status: 'new',
          read: false
        });
        
        // Show success message
        showFeedback('Thank you for your message! It has been sent to the admin dashboard, and I will get back to you soon.', 'success');
        
        // Clear the form
        contactForm.reset();
      } catch (error) {
        console.error('Error submitting contact form:', error);
        showFeedback('Sorry, there was an error sending your message. Please try again later.', 'error');
      } finally {
        // Re-enable the submit button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    });
  }
  
  // Function to show feedback to the user
  function showFeedback(message, type) {
    const feedbackElement = document.getElementById('form-feedback');
    if (feedbackElement) {
      feedbackElement.textContent = message;
      feedbackElement.style.display = 'block';
      
      if (type === 'success') {
        feedbackElement.style.backgroundColor = '#dff0d8';
        feedbackElement.style.color = '#3c763d';
        feedbackElement.style.border = '1px solid #d6e9c6';
      } else if (type === 'error') {
        feedbackElement.style.backgroundColor = '#f2dede';
        feedbackElement.style.color = '#a94442';
        feedbackElement.style.border = '1px solid #ebccd1';
      }
      
      // Scroll to the feedback message
      feedbackElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Clear the message after 5 seconds for success messages
      if (type === 'success') {
        setTimeout(() => {
          feedbackElement.style.display = 'none';
        }, 5000);
      }
    }
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
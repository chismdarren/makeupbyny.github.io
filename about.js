// Import necessary Firebase modules
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth, isAdminUser } from "./firebase-config.js";
import { getFirestore, doc, getDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const db = getFirestore();

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Get all the DOM elements once
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const userAccountLink = document.getElementById("userAccountLink");
  const settingsIcon = document.getElementById('settingsIcon');
  const adminDropdownBtn = document.getElementById("adminDropdownBtn");

  // Monitor user authentication state
  onAuthStateChanged(auth, async (user) => {
    // If user is logged in
    if (user) {
      // Hide login button, show logout button and account link
      if (loginLink) loginLink.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline";
      if (userAccountLink) userAccountLink.style.display = "inline";
      
      // Show settings icon
      if (settingsIcon) settingsIcon.style.display = 'flex';

      // Check if user is admin
      const isAdmin = await isAdminUser(user.uid);
      if (isAdmin) {
        // Show admin dropdown button
        if (adminDropdownBtn) adminDropdownBtn.style.display = "inline";
      } else {
        // Hide admin dropdown button for regular users
        if (adminDropdownBtn) adminDropdownBtn.style.display = "none";
      }
    } else {
      // If user is not logged in, show login button and hide user features
      if (loginLink) loginLink.style.display = "inline";
      if (logoutBtn) logoutBtn.style.display = "none";
      if (userAccountLink) userAccountLink.style.display = "none";
      if (adminDropdownBtn) adminDropdownBtn.style.display = "none";
      
      // Hide settings icon
      if (settingsIcon) settingsIcon.style.display = 'none';
    }
  });

  // Handle logout button click
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      auth.signOut().then(() => {
        window.location.href = "index.html";
      });
    });
  }

  // Add smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      
      // Skip empty or just # links
      if (!href || href === '#') return;
      
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Add animation to about cards on scroll
  const observerOptions = {
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
      }
    });
  }, observerOptions);

  // Observe all about cards
  document.querySelectorAll('.about-card').forEach(card => {
    observer.observe(card);
  });
});

// Class to manage about content
class AboutManager {
    constructor() {
        this.aboutContent = null;
        this.observers = new Set();
        this.initialized = false;
    }

    // Initialize the about content listener
    async init() {
        if (this.initialized) return;
        
        // Set up real-time listener for about content
        const aboutRef = doc(db, "content", "about");
        onSnapshot(aboutRef, (doc) => {
            if (doc.exists()) {
                this.aboutContent = doc.data();
                this.notifyObservers();
            }
        });

        this.initialized = true;
    }

    // Add observer to be notified of content changes
    addObserver(callback) {
        this.observers.add(callback);
        // If we already have content, notify immediately
        if (this.aboutContent) {
            callback(this.aboutContent);
        }
    }

    // Remove observer
    removeObserver(callback) {
        this.observers.delete(callback);
    }

    // Notify all observers of content changes
    notifyObservers() {
        this.observers.forEach(callback => callback(this.aboutContent));
    }

    // Update about content
    async updateContent(newContent) {
        try {
            const aboutRef = doc(db, "content", "about");
            await updateDoc(aboutRef, {
                ...newContent,
                lastUpdated: new Date()
            });
            return true;
        } catch (error) {
            console.error("Error updating about content:", error);
            return false;
        }
    }

    // Get current about content
    async getContent() {
        if (this.aboutContent) return this.aboutContent;

        try {
            const aboutRef = doc(db, "content", "about");
            const docSnap = await getDoc(aboutRef);
            if (docSnap.exists()) {
                this.aboutContent = docSnap.data();
                return this.aboutContent;
            }
            return null;
        } catch (error) {
            console.error("Error getting about content:", error);
            return null;
        }
    }
}

// Create singleton instance
const aboutManager = new AboutManager();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    aboutManager.init();
});

// Function to make content editable
function makeEditable(element, onSave) {
    // Safety check for null element
    if (!element) {
        console.warn('Cannot make null element editable');
        return;
    }

    // Safety check for parent element
    const parentElement = element.parentElement;
    if (!parentElement) {
        console.warn('Cannot make element editable: no parent element found');
        return;
    }

    let isEditing = false;
    const editButton = document.createElement('button');
    editButton.className = 'edit-button';
    editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    editButton.style.display = 'none'; // Hidden by default

    // Set parent element styles and append button only if parent exists
    if (parentElement) {
        parentElement.style.position = 'relative';
        parentElement.appendChild(editButton);

        // Show edit button for admin users
        isAdminUser().then(isAdmin => {
            if (isAdmin) {
                editButton.style.display = 'block';
            }
        });

        editButton.addEventListener('click', () => {
            if (!isEditing) {
                // Enter edit mode
                element.contentEditable = true;
                element.focus();
                editButton.innerHTML = '<i class="fas fa-save"></i>';
                element.classList.add('editing');
            } else {
                // Save changes
                element.contentEditable = false;
                editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
                element.classList.remove('editing');
                if (onSave) {
                    onSave(element.innerHTML);
                }
            }
            isEditing = !isEditing;
        });
    }
}

export { aboutManager, makeEditable }; 
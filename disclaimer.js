// Import necessary Firebase modules
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth, isAdminUser, db } from "./firebase-config.js";

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Show loading spinner at the beginning
  const contentLoader = document.getElementById('contentLoader');
  
  // Initialize edit mode state
  let editMode = false;
  const editableElements = document.querySelectorAll('.editable');
  const editModeToggle = document.getElementById('edit-mode-toggle');
  const saveStatus = document.getElementById('save-status');
  
  // Monitor user authentication state
  onAuthStateChanged(auth, async (user) => {
    // If user is logged in
    if (user) {
      // Hide login button, show logout button and account link
      document.getElementById("login-link").style.display = "none";
      document.getElementById("logout-btn").style.display = "inline";
      document.getElementById("userAccountLink").style.display = "inline";
      
      // Show settings icon
      const settingsIcon = document.getElementById('settingsIcon');
      if (settingsIcon) settingsIcon.style.display = 'flex';

      // Check if user is admin
      const isAdmin = await isAdminUser(user.uid);
      if (isAdmin) {
        // Show admin dropdown button
        document.getElementById("adminDropdownBtn").style.display = "inline";
        
        // Show edit mode toggle for admins
        if (editModeToggle) {
          editModeToggle.style.display = 'flex';
          
          // Add event listener for edit mode toggle
          editModeToggle.addEventListener('click', () => {
            editMode = !editMode;
            editModeToggle.classList.toggle('active');
            
            // Toggle contenteditable for all editable elements
            editableElements.forEach(el => {
              el.contentEditable = editMode;
              el.classList.toggle('edit-mode', editMode);
              
              // Add blur event listener for saving when editing is complete
              if (editMode) {
                el.addEventListener('blur', handleContentEdit);
              } else {
                el.removeEventListener('blur', handleContentEdit);
              }
            });
          });
        }
      } else {
        // Hide admin dropdown button for regular users
        document.getElementById("adminDropdownBtn").style.display = "none";
      }
    } else {
      // If user is not logged in, show login button and hide user features
      document.getElementById("login-link").style.display = "inline";
      document.getElementById("logout-btn").style.display = "none";
      document.getElementById("userAccountLink").style.display = "none";
      document.getElementById("adminDropdownBtn").style.display = "none";
      
      // Hide settings icon
      const settingsIcon = document.getElementById('settingsIcon');
      if (settingsIcon) settingsIcon.style.display = 'none';
    }
  });

  // Handle logout button click
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  // Toggle dropdown menu on click
  const adminDropdownBtn = document.getElementById("adminDropdownBtn");
  if (adminDropdownBtn) {
    adminDropdownBtn.addEventListener("click", function(e) {
      e.preventDefault(); // Prevent default link behavior
      this.classList.toggle("active");
      document.getElementById("adminDropdownContent").classList.toggle("show-dropdown");
    });
  }

  // Close dropdown when clicking outside
  window.addEventListener("click", function(e) {
    if (!e.target.matches('#adminDropdownBtn') && !e.target.matches('.dropdown-icon')) {
      const dropdown = document.getElementById("adminDropdownContent");
      const btn = document.getElementById("adminDropdownBtn");
      if (dropdown && dropdown.classList.contains("show-dropdown")) {
        dropdown.classList.remove("show-dropdown");
        btn.classList.remove("active");
      }
    }
  });
  
  // Load stored content from Firebase or localStorage
  loadStoredContent()
    .then(() => {
      // Show content when loaded
      const editableContainers = document.querySelectorAll('.editable-container');
      editableContainers.forEach(container => {
        container.classList.add('loaded');
      });
      
      // Hide loader when content is loaded
      if (contentLoader) {
        setTimeout(() => {
          contentLoader.classList.add('hidden');
        }, 300); // Small delay for smoother transition
      }
    })
    .catch(error => {
      console.error('Error loading content:', error);
      // Show content even if there was an error
      const editableContainers = document.querySelectorAll('.editable-container');
      editableContainers.forEach(container => {
        container.classList.add('loaded');
      });
      
      // Hide loader
      if (contentLoader) {
        contentLoader.classList.add('hidden');
      }
    });
});

// Handle content edits
function handleContentEdit(event) {
  const element = event.target;
  
  // Show saving status
  const saveStatus = document.getElementById('save-status');
  if (saveStatus) {
    saveStatus.textContent = 'Saving changes...';
    saveStatus.className = 'show saving';
  }
  
  // Save to Firebase
  saveContentToFirebase([element], db)
    .then(() => {
      // Show success message
      if (saveStatus) {
        saveStatus.textContent = 'Changes saved!';
        saveStatus.className = 'show success';
        
        // Hide the message after 2 seconds
        setTimeout(() => {
          saveStatus.className = '';
        }, 2000);
      }
    })
    .catch(error => {
      console.error('Error saving content:', error);
      // Show error message
      if (saveStatus) {
        saveStatus.textContent = 'Error saving changes';
        saveStatus.className = 'show error';
        
        // Hide the message after 3 seconds
        setTimeout(() => {
          saveStatus.className = '';
        }, 3000);
      }
    });
}

// Load stored content from Firebase or localStorage
async function loadStoredContent() {
  try {
    const pagePath = window.location.pathname.split('/').pop() || 'disclaimer.html';
    const contentRef = db.collection('siteContent');
    const editableElements = document.querySelectorAll('.editable');
    
    // For each editable element
    for (const element of editableElements) {
      // Get element path (multi-strategy approach)
      let path = getElementPath(element);
      
      // Try to find document in Firebase
      let docId = `${pagePath}_${path}`;
      let docSnap = await contentRef.doc(docId).get();
      
      // If not found in Firebase, try localStorage
      if (!docSnap.exists) {
        const localContent = localStorage.getItem(docId);
        if (localContent) {
          element.innerHTML = localContent;
          continue;
        }
        
        // If we have special case for footer copyright
        if (element.parentNode && element.parentNode.tagName.toLowerCase() === 'footer' && 
            element.textContent && element.textContent.includes('©')) {
          // Try with special footer path
          docId = `${pagePath}_footer-copyright`;
          docSnap = await contentRef.doc(docId).get();
          if (docSnap.exists) {
            element.innerHTML = docSnap.data().content;
            continue;
          }
        }
        
        // Last resort: try to match by text content hash
        if (element.textContent) {
          // Get all documents for this page as fallback
          const querySnap = await contentRef.where('page', '==', pagePath).get();
          let found = false;
          
          querySnap.forEach(doc => {
            const data = doc.data();
            // Try to identify by checking if the content is similar
            if (data.content && element.textContent.trim() && 
                (data.content.includes(element.textContent.substring(0, 20).trim()) || 
                 element.textContent.includes(data.content.substring(0, 20).trim()))) {
              element.innerHTML = data.content;
              found = true;
            }
          });
          
          if (found) continue;
        }
        
        // If all else fails, keep the existing content
        console.log('No stored content found for element, keeping original content:', path);
      } else {
        // Content found in Firebase, apply it
        element.innerHTML = docSnap.data().content;
      }
    }
  } catch (error) {
    console.error('Error loading stored content:', error);
    throw error;
  }
}

// Handle logout functionality
function handleLogout() {
  signOut(auth).then(() => {
    console.log('User signed out');
    window.location.href = 'index.html';
  }).catch(error => {
    console.error('Error signing out:', error);
  });
} 
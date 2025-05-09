// Import necessary Firebase modules
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth, isAdminUser, db } from "./firebase-config.js";
import { collection, doc, getDoc, getDocs, setDoc, query, where, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Save content to Firebase
function saveContentToFirebase(elements, db) {
  return new Promise(async (resolve, reject) => {
    if (!db) {
      console.error("Firebase is not initialized");
      reject("Firebase is not initialized");
      return;
    }
    
    try {
      const batch = writeBatch(db);
      const pagePath = window.location.pathname.split('/').pop() || 'disclaimer.html';
      
      // Save each element's content
      elements.forEach(element => {
        const path = getElementPath(element);
        if (!path) return;
        
        const docId = `${pagePath}_${path}`;
        const docRef = doc(db, 'siteContent', docId);
        
        batch.set(docRef, {
          content: element.innerHTML,
          path: path,
          page: pagePath,
          lastUpdated: serverTimestamp()
        });
        
        // Also save to localStorage as backup
        localStorage.setItem(docId, element.innerHTML);
      });
      
      // Commit the batch
      await batch.commit();
      console.log("Content saved successfully");
      resolve();
    } catch (error) {
      console.error("Error in saveContentToFirebase: ", error);
      reject(error);
    }
  });
}

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
    const contentRef = collection(db, 'siteContent');
    const editableElements = document.querySelectorAll('.editable');
    
    // For each editable element
    for (const element of editableElements) {
      // Get element path (multi-strategy approach)
      let path = getElementPath(element);
      
      // Try to find document in Firebase
      let docId = `${pagePath}_${path}`;
      let docSnap = await getDoc(doc(db, 'siteContent', docId));
      
      // If not found in Firebase, try localStorage
      if (!docSnap.exists()) {
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
          docSnap = await getDoc(doc(db, 'siteContent', docId));
          if (docSnap.exists()) {
            element.innerHTML = docSnap.data().content;
            continue;
          }
        }
        
        // Last resort: try to match by text content hash
        if (element.textContent) {
          // Get all documents for this page as fallback
          const q = query(contentRef, where('page', '==', pagePath));
          const querySnap = await getDocs(q);
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

// Function to generate a unique path for each element based on its position in the DOM
function getElementPath(element) {
  if (!element) return '';
  
  // Start with the tag name
  let path = element.tagName.toLowerCase();
  
  // Add id if it exists
  if (element.id) {
    path += '#' + element.id;
    return path; // ID should be unique, so we can stop here
  }
  
  // Add classes
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/);
    if (classes.length > 0 && classes[0] !== '') {
      path += '.' + classes.join('.');
    }
  }
  
  // Get the index of the element among its siblings of the same type
  if (element.parentNode) {
    const siblings = Array.from(element.parentNode.children);
    const sameSiblings = siblings.filter(sibling => sibling.tagName === element.tagName);
    if (sameSiblings.length > 1) {
      const index = sameSiblings.indexOf(element);
      path += `:nth-of-type(${index + 1})`;
    }
  }
  
  // Add text content hash for better identification
  if (element.textContent) {
    // Create a simple hash of the first 30 chars of text content
    const textSample = element.textContent.trim().substring(0, 30).replace(/\s+/g, ' ');
    if (textSample) {
      // Using simple hash for brevity
      let hash = 0;
      for (let i = 0; i < textSample.length; i++) {
        hash = ((hash << 5) - hash) + textSample.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      path += `[text="${hash}"]`;
    }
  }
  
  // Handle special case for footer copyright
  if (element.parentNode && element.parentNode.tagName.toLowerCase() === 'footer' && 
      element.textContent && element.textContent.includes('©')) {
    return 'footer-copyright';
  }
  
  return path;
} 
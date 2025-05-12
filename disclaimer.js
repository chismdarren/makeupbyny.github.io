// Import necessary Firebase modules
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, query, where, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { auth, isAdminUser, db } from "./firebase-config.js";

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("Disclaimer.js loaded and running");
  // Show loading spinner at the beginning
  const contentLoader = document.getElementById('contentLoader');
  
  // Initialize edit mode state
  let editMode = false;
  const editableElements = document.querySelectorAll('.editable');
  console.log("Found editable elements:", editableElements.length);
  const editModeToggle = document.getElementById('edit-mode-toggle');
  console.log("Edit mode toggle found:", !!editModeToggle);
  const saveStatus = document.getElementById('save-status');
  
  // Monitor user authentication state
  onAuthStateChanged(auth, async (user) => {
    console.log("Auth state changed, user:", user ? user.email : "not logged in");
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
      console.log("Is admin user:", isAdmin);
      if (isAdmin) {
        // Show admin dropdown button
        document.getElementById("adminDropdownBtn").style.display = "inline";
        
        // Show edit mode toggle for admins
        if (editModeToggle) {
          editModeToggle.style.display = 'flex';
          console.log("Edit mode toggle visible for admin");
          
          // Add event listener for edit mode toggle
          editModeToggle.addEventListener('click', () => {
            editMode = !editMode;
            console.log("Edit mode toggled to:", editMode);
            editModeToggle.classList.toggle('active');
            
            // Toggle contenteditable for all editable elements
            editableElements.forEach(el => {
              el.contentEditable = editMode;
              el.classList.toggle('edit-mode', editMode);
              console.log("Set contenteditable for element:", el.tagName, el.className);
              
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
      
      // Find adminDropdownContent or use the black-box as fallback
      const dropdown = document.getElementById("adminDropdownContent") || document.querySelector(".black-box");
      if (dropdown) {
        dropdown.classList.toggle("show-dropdown");
        if (!dropdown.classList.contains("show-dropdown")) {
          // If not showing via class, use direct style
          dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        }
      } else {
        console.error("Admin dropdown content element not found");
      }
    });
  }

  // Close dropdown when clicking outside
  window.addEventListener("click", function(e) {
    if (!e.target.matches('#adminDropdownBtn') && !e.target.matches('.dropdown-icon')) {
      const dropdown = document.getElementById("adminDropdownContent") || document.querySelector(".black-box");
      const btn = document.getElementById("adminDropdownBtn");
      if (dropdown && (dropdown.classList.contains("show-dropdown") || dropdown.style.display === 'block')) {
        dropdown.classList.remove("show-dropdown");
        dropdown.style.display = 'none';
        if (btn) btn.classList.remove("active");
      }
    }
  });
  
  // Load stored content from Firebase or localStorage
  loadStoredContent()
    .then(() => {
      console.log("Content loaded successfully");
      // Show content when loaded
      const editableContainers = document.querySelectorAll('.editable-container');
      console.log("Found editable containers:", editableContainers.length);
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
function saveContentToFirebase(elements, db, timestamp) {
  return new Promise(async (resolve, reject) => {
    if (!db) {
      console.error("Firebase is not initialized");
      reject("Firebase is not initialized");
      return;
    }
    
    try {
      console.log("Starting save to Firebase");
      const batch = writeBatch(db);
      const pagePath = window.location.pathname.split('/').pop() || 'disclaimer.html';
      console.log("Current page path:", pagePath);
      
      // Use the provided timestamp or generate a new one
      const finalTimestamp = timestamp || new Date().getTime();
      
      // Save each element's content
      elements.forEach(element => {
        const path = getElementPath(element);
        console.log("Saving element with path:", path);
        if (!path) return;
        
        const docId = `${pagePath}_${path}`;
        console.log("Document ID:", docId);
        const docRef = doc(db, 'siteContent', docId);
        
        batch.set(docRef, {
          content: element.innerHTML,
          path: path,
          page: pagePath,
          timestamp: finalTimestamp,
          lastUpdated: serverTimestamp()
        });
        
        // Also save to localStorage as backup with timestamp
        const contentData = {
          content: element.innerHTML,
          timestamp: finalTimestamp
        };
        localStorage.setItem(docId, JSON.stringify(contentData));
        console.log("Saved to localStorage with timestamp:", docId);
      });
      
      // Commit the batch
      await batch.commit();
      console.log("Content saved successfully to Firebase");
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
  console.log("Content edited:", element.tagName, element.className);
  
  // Show saving status
  const saveStatus = document.getElementById('save-status');
  if (saveStatus) {
    saveStatus.textContent = 'Saving changes...';
    saveStatus.className = 'show saving';
  }
  
  // Get timestamp for this edit - use milliseconds for precision
  const now = new Date().getTime();
  
  // Save to localStorage with timestamp
  const pagePath = window.location.pathname.split('/').pop() || 'disclaimer.html';
  const path = getElementPath(element);
  const localStorageKey = `${pagePath}_${path}`;
  
  // Check if we already have stored data with a timestamp
  const existingDataString = localStorage.getItem(localStorageKey);
  let existingTimestamp = 0;
  
  if (existingDataString) {
    try {
      const existingData = JSON.parse(existingDataString);
      existingTimestamp = existingData.timestamp || 0;
    } catch (e) {
      console.warn("Couldn't parse existing localStorage data, treating as new edit");
    }
  }
  
  // Ensure our new timestamp is always higher than any existing one
  const finalTimestamp = Math.max(now, existingTimestamp + 1);
  
  // Create data object with content and timestamp
  const contentData = {
    content: element.innerHTML,
    timestamp: finalTimestamp
  };
  
  // Save to localStorage with timestamp
  localStorage.setItem(localStorageKey, JSON.stringify(contentData));
  console.log(`Saved to localStorage with timestamp ${finalTimestamp} (previous: ${existingTimestamp})`);
  
  // Also save to alternative format used by the edit script
  try {
    const pageDocId = "disclaimer_page_content";
    const existingAltData = localStorage.getItem(pageDocId);
    let altContent = {};
    
    if (existingAltData) {
      try {
        const parsedData = JSON.parse(existingAltData);
        if (parsedData && parsedData.content) {
          altContent = parsedData.content;
        }
      } catch (e) {
        console.warn("Error parsing existing alternative storage:", e);
      }
    }
    
    // Generate a unique key for this element in the alternative format
    const elementTag = element.tagName.toLowerCase();
    const contentSample = element.textContent.trim().substring(0, 15).replace(/\s+/g, '-');
    const altKey = `${elementTag}_${contentSample}_${Date.now().toString(36)}`;
    
    // Add this content to the alternative storage
    altContent[altKey] = {
      content: element.innerHTML,
      elementType: elementTag
    };
    
    // Save the updated alternative storage
    const altData = {
      content: altContent,
      timestamp: new Date().toISOString(),
      pageId: pageDocId
    };
    
    localStorage.setItem(pageDocId, JSON.stringify(altData));
    console.log("Updated alternative storage format");
  } catch (altError) {
    console.warn("Error updating alternative storage format:", altError);
  }
  
  // Save to Firebase
  saveContentToFirebase([element], db, finalTimestamp)
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
        saveStatus.textContent = 'Error saving to cloud. Saved locally.';
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
    
    console.log(`Loading content for ${editableElements.length} editable elements`);
    
    // Check for alternative storage format
    let alternativeContent = null;
    let alternativeTimestamp = 0;
    
    try {
      const pageDocId = "disclaimer_page_content";
      const localData = localStorage.getItem(pageDocId);
      if (localData) {
        const parsedData = JSON.parse(localData);
        if (parsedData && parsedData.content) {
          console.log("Found alternative format content in localStorage");
          alternativeContent = parsedData.content;
          // Convert ISO string to timestamp if needed
          if (parsedData.timestamp) {
            if (typeof parsedData.timestamp === 'string') {
              alternativeTimestamp = new Date(parsedData.timestamp).getTime();
            } else if (typeof parsedData.timestamp === 'number') {
              alternativeTimestamp = parsedData.timestamp;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Error parsing alternative storage format:", e);
    }
    
    // For each editable element
    for (const element of editableElements) {
      // Get element path
      let path = getElementPath(element);
      console.log(`Loading content for element with path: ${path}`);
      
      let bestContent = null;
      let bestTimestamp = 0;
      let source = "original";
      
      // Try localStorage first (it's faster and might have newer content)
      const localStorageKey = `${pagePath}_${path}`;
      const localData = localStorage.getItem(localStorageKey);
      
      if (localData) {
        try {
          const parsedData = JSON.parse(localData);
          if (parsedData && parsedData.content && parsedData.timestamp) {
            bestContent = parsedData.content;
            bestTimestamp = parsedData.timestamp;
            source = "localStorage";
            console.log(`Found content in localStorage with timestamp ${bestTimestamp}`);
          }
        } catch (e) {
          console.warn("Error parsing localStorage data:", e);
          // If it's not JSON, it might be old-format direct content
          bestContent = localData;
          bestTimestamp = 1; // Low but not zero
          source = "localStorage-legacy";
        }
      }
      
      // Check the alternative storage for this element
      if (alternativeContent) {
        // Look for a matching element in the alternative content
        for (const altPath in alternativeContent) {
          const altData = alternativeContent[altPath];
          
          // Try to find a match based on element tag or content similarity
          let isMatch = false;
          
          // Check if tags match
          if (altData.elementType && altData.elementType.toLowerCase() === element.tagName.toLowerCase()) {
            // Simple content matching (if first 15 chars are similar)
            const currentContent = element.textContent.trim().substring(0, 15);
            const altContent = altData.content.replace(/<[^>]*>/g, '').trim().substring(0, 15);
            
            if (currentContent.includes(altContent) || altContent.includes(currentContent)) {
              isMatch = true;
            }
            
            // For footer copyright elements, special case
            if (element.parentNode && element.parentNode.tagName.toLowerCase() === 'footer' && 
                altData.content.includes('©')) {
              isMatch = true;
            }
          }
          
          if (isMatch && alternativeTimestamp > bestTimestamp) {
            bestContent = altData.content;
            bestTimestamp = alternativeTimestamp;
            source = "alternative-storage";
            console.log(`Found matching content in alternative storage with timestamp ${alternativeTimestamp}`);
          }
        }
      }
      
      // Now try Firebase (might have even newer content)
      try {
        // Try to find document in Firebase by path
        let docId = `${pagePath}_${path}`;
        let docSnap = await getDoc(doc(db, 'siteContent', docId));
        
        if (docSnap.exists()) {
          // Get timestamp from Firebase - convert server timestamp if needed
          let firebaseTimestamp = docSnap.data().timestamp;
          if (!firebaseTimestamp && docSnap.data().lastUpdated) {
            // Try to use lastUpdated if timestamp doesn't exist
            if (docSnap.data().lastUpdated.toMillis) {
              // If it's a server timestamp object
              firebaseTimestamp = docSnap.data().lastUpdated.toMillis();
            } else if (typeof docSnap.data().lastUpdated === 'number') {
              firebaseTimestamp = docSnap.data().lastUpdated;
            }
          }
          
          // If Firebase has newer content (or no timestamps to compare), use it
          if (firebaseTimestamp && firebaseTimestamp > bestTimestamp) {
            bestContent = docSnap.data().content;
            bestTimestamp = firebaseTimestamp;
            source = "firebase";
            console.log(`Found content in Firebase with newer timestamp ${firebaseTimestamp}`);
          } else if (firebaseTimestamp) {
            console.log(`Firebase content found but older (${firebaseTimestamp} vs ${bestTimestamp}), keeping ${source} content`);
          } else {
            // If no Firebase timestamp, use it only if we don't have content yet
            if (!bestContent) {
              bestContent = docSnap.data().content;
              source = "firebase-no-timestamp";
              console.log(`Found content in Firebase (no timestamp), using as fallback`);
            }
          }
        } else {
          // Special case for footer copyright
          if (element.parentNode && element.parentNode.tagName.toLowerCase() === 'footer' && 
              element.textContent && element.textContent.includes('©')) {
            // Try with special footer path
            docId = `${pagePath}_footer-copyright`;
            docSnap = await getDoc(doc(db, 'siteContent', docId));
            if (docSnap.exists()) {
              let firebaseTimestamp = docSnap.data().timestamp;
              
              // Compare timestamps if available
              if (!firebaseTimestamp || firebaseTimestamp > bestTimestamp) {
                bestContent = docSnap.data().content;
                bestTimestamp = firebaseTimestamp || 1;
                source = "firebase-special-footer";
                console.log(`Found special footer content in Firebase`);
              }
            }
          } else {
            // Last resort: try to match by text content similarity
            if (element.textContent && !bestContent) {
              // Get all documents for this page as fallback
              const q = query(contentRef, where('page', '==', pagePath));
              const querySnap = await getDocs(q);
              
              querySnap.forEach(docItem => {
                const data = docItem.data();
                // Try to identify by checking if the content is similar
                if (data.content && element.textContent.trim() && 
                    (data.content.includes(element.textContent.substring(0, 20).trim()) || 
                     element.textContent.includes(data.content.substring(0, 20).trim()))) {
                  
                  let docTimestamp = data.timestamp;
                  if (!docTimestamp && data.lastUpdated) {
                    if (data.lastUpdated.toMillis) {
                      docTimestamp = data.lastUpdated.toMillis();
                    } else if (typeof data.lastUpdated === 'number') {
                      docTimestamp = data.lastUpdated;
                    }
                  }
                  
                  // Use this content only if it's newer or we have nothing yet
                  if (!bestContent || (docTimestamp && docTimestamp > bestTimestamp)) {
                    bestContent = data.content;
                    bestTimestamp = docTimestamp || 1;
                    source = "firebase-content-match";
                  }
                }
              });
            }
          }
        }
      } catch (firebaseError) {
        console.warn(`Error checking Firebase for content:`, firebaseError);
      }
      
      // Apply the best content we found, if any
      if (bestContent) {
        console.log(`Applying content from ${source} with timestamp ${bestTimestamp}`);
        element.innerHTML = bestContent;
      } else {
        console.log(`No stored content found for element, keeping original`);
      }
    }
    
    console.log("Content loading complete");
  } catch (error) {
    console.error('Error in loadStoredContent:', error);
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
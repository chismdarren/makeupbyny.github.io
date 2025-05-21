// Import Firebase modules
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, isAdminUser } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

export class ContentEditor {
  constructor() {
    this.editButton = document.getElementById('edit-mode-toggle');
    this.editableElements = document.querySelectorAll('.editable');
    this.editModeActive = false;
    this.originalContent = new Map();
    this.changeHistory = [];
    this.unsavedChanges = new Map();
    
    // Track when loading screen was shown
    this.loadingStartTime = Date.now();
    // Minimum time to show loading screen (2.5 seconds)
    this.minLoadingTime = 2500;
    
    // Create loading screen
    this.createLoadingScreen();
    
    console.log('Found editable elements:', this.editableElements.length);
    
    // Generate consistent IDs for elements
    this.editableElements.forEach((element, index) => {
      if (!element.id) {
        // Create a consistent ID based on:
        // 1. The page name
        // 2. The element's tag
        // 3. The element's position in the document
        const pageName = window.location.pathname.split('/').pop() || 'index.html';
        const elementTag = element.tagName.toLowerCase();
        const parentTag = element.parentElement.tagName.toLowerCase();
        const parentClass = element.parentElement.classList[0] || '';
        
        // Find position among similar elements in the same parent
        const siblings = Array.from(element.parentElement.children)
          .filter(el => el.tagName === element.tagName && el.classList.contains('editable'));
        const position = siblings.indexOf(element);
        
        // Create a consistent ID that will be the same on page reload
        element.id = `${pageName}-${parentTag}${parentClass ? '-' + parentClass : ''}-${elementTag}-${position}`;
      }
      
      // Hide element initially
      element.style.opacity = '0';
      
      // Store original content using element ID
      this.originalContent.set(element.id, {
        content: element.innerHTML,
        lastModified: new Date().toISOString(),
        version: 1,
        // Store element position info for verification
        position: {
          tag: element.tagName.toLowerCase(),
          parentTag: element.parentElement.tagName.toLowerCase(),
          parentClass: element.parentElement.classList[0] || '',
          index: Array.from(element.parentElement.children)
            .filter(el => el.tagName === element.tagName && el.classList.contains('editable'))
            .indexOf(element)
        }
      });

      // Add input event listener
      element.addEventListener('input', () => {
        if (this.editModeActive) {
          this.unsavedChanges.set(element.id, element.innerHTML);
          console.log('Change tracked for element:', element.id);
        }
      });
    });

    // Set up auth state listener for edit button visibility
    this.setupAuthListener();

    // Bind event listeners
    this.initializeEventListeners();
    this.loadSavedContent();
  }

  setupAuthListener() {
    if (this.editButton) {
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          // User is logged in, check if they're an admin
          const isAdmin = await isAdminUser(user.uid);
          this.editButton.style.display = isAdmin ? 'flex' : 'none';
        } else {
          // User is logged out, hide edit button
          this.editButton.style.display = 'none';
        }
      });
    }
  }

  createLoadingScreen() {
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      transition: opacity 0.5s ease-out;
    `;

    // Add logo
    const logo = document.createElement('img');
    logo.src = 'nbvlogo.png';
    logo.alt = "Ny's Beauty Vault Logo";
    logo.style.cssText = `
      width: 200px;
      height: auto;
      margin-bottom: 20px;
    `;

    // Add loading spinner
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 50px;
      height: 50px;
      border: 5px solid #f3f3f3;
      border-top: 5px solid #555;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;

    // Add keyframe animation for spinner
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    loadingScreen.appendChild(logo);
    loadingScreen.appendChild(spinner);
    document.body.appendChild(loadingScreen);
    this.loadingScreen = loadingScreen;
  }

  hideLoadingScreen() {
    if (this.loadingScreen) {
      const currentTime = Date.now();
      const elapsedTime = currentTime - this.loadingStartTime;
      const remainingTime = Math.max(0, this.minLoadingTime - elapsedTime);

      // Wait for minimum time to pass before hiding
      setTimeout(() => {
        this.loadingScreen.style.opacity = '0';
        
        // After fade out, show content and remove loading screen
        setTimeout(() => {
          this.loadingScreen.style.display = 'none';
          
          // Fade in all editable elements
          this.editableElements.forEach(element => {
            element.style.transition = 'opacity 0.5s ease-in';
            element.style.opacity = '1';
          });
        }, 500);
      }, remainingTime);
    }
  }

  initializeEventListeners() {
    // Only set up edit button if it exists
    if (this.editButton) {
      console.log('Edit button found, setting up click handler');
      this.editButton.addEventListener('click', () => {
        console.log('Edit button clicked');
        this.toggleEditMode();
      });
    } else {
      console.warn('Edit button not found');
    }

    // Add undo button to the page
    this.addUndoButton();
  }

  addUndoButton() {
    // Create undo button
    const undoButton = document.createElement('div');
    undoButton.id = 'undo-button';
    undoButton.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      width: 40px;
      height: 40px;
      background-color: #fff;
      border-radius: 50%;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      display: none;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      z-index: 9999;
      transition: transform 0.3s ease, background-color 0.3s ease;
    `;
    undoButton.innerHTML = '<i class="fas fa-undo"></i>';
    
    // Add hover effect
    undoButton.addEventListener('mouseover', () => {
      undoButton.style.transform = 'scale(1.1)';
    });
    undoButton.addEventListener('mouseout', () => {
      undoButton.style.transform = 'scale(1)';
    });

    // Add click handler
    undoButton.addEventListener('click', () => {
      this.undoLastChange();
    });

    document.body.appendChild(undoButton);
    this.undoButton = undoButton;
  }

  async undoLastChange() {
    if (this.changeHistory.length === 0) {
      this.showNotification('No changes to undo', 'info');
      return;
    }

    const lastChange = this.changeHistory.pop();
    console.log('Undoing last change. History state:', lastChange);

    try {
      // Revert the content
      this.editableElements.forEach(element => {
        const elementId = element.id;
        const previousState = lastChange[elementId];
        
        if (previousState) {
          console.log(`Reverting ${elementId} to:`, previousState);
          element.innerHTML = previousState.content;
          
          // Update original content map
          this.originalContent.set(elementId, {
            content: previousState.content,
            lastModified: previousState.lastModified,
            version: previousState.version
          });
        } else {
          console.log(`No previous state found for ${elementId}`);
        }
      });

      // Save to Firebase - create a complete snapshot of all content
      const revertedContent = {};
      this.editableElements.forEach(element => {
        const elementId = element.id;
        const currentData = this.originalContent.get(elementId);
        if (currentData) {
          revertedContent[elementId] = {
            content: currentData.content,
            elementType: element.tagName.toLowerCase(),
            lastModified: currentData.lastModified,
            version: currentData.version
          };
        }
      });

      console.log('Saving complete content snapshot to Firebase:', revertedContent);
      await this.saveContentToFirebase(revertedContent);
      this.showNotification('Changes undone successfully!', 'success');
      
      // Hide undo button if no more changes to undo
      if (this.changeHistory.length === 0 && this.undoButton) {
        this.undoButton.style.display = 'none';
      }
    } catch (error) {
      console.error('Error undoing changes:', error);
      this.showNotification('Error undoing changes: ' + error.message, 'error');
    }
  }

  toggleEditMode() {
    console.log('Toggling edit mode');
    this.editModeActive = !this.editModeActive;
    
    if (this.editModeActive) {
      this.enterEditMode();
    } else {
      this.exitEditMode();
    }
  }

  enterEditMode() {
    console.log('Entering edit mode');
    this.editButton.classList.add('active');
    this.editButton.innerHTML = '<i class="fas fa-save"></i>';
    
    // Get current page name
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    this.editableElements.forEach(element => {
      // Check if element is a title (h2 or h3)
      const isTitle = element.tagName.toLowerCase() === 'h2' || element.tagName.toLowerCase() === 'h3';
      // Check if element is part of the about section
      const isAboutSection = element.classList.contains('about-intro') || element.classList.contains('about-description');
      const isHomePage = currentPage === 'index.html';
      
      // Make element editable if:
      // 1. It's a title on the about page, OR
      // 2. It's not an about section element, OR
      // 3. It's an about section element on the home page
      if ((isTitle && currentPage === 'about.html') || !isAboutSection || isHomePage) {
        element.setAttribute('contenteditable', 'true');
        element.classList.add('edit-mode');
      }
    });

    // Clear unsaved changes when entering edit mode
    this.unsavedChanges.clear();
  }

  async exitEditMode() {
    this.editButton.classList.remove('active');
    this.editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    
    const updatedContent = {};
    let hasChanges = false;
    
    // Store previous state
    const previousState = {};
    this.editableElements.forEach(element => {
      const originalData = this.originalContent.get(element.id);
      if (originalData) {
        previousState[element.id] = { ...originalData };
      }
    });
    
    // Process changes
    this.unsavedChanges.forEach((newContent, elementId) => {
      const originalData = this.originalContent.get(elementId);
      
      if (!originalData) return;
      
      if (newContent !== originalData.content) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        updatedContent[elementId] = {
          content: newContent,
          elementType: element.tagName.toLowerCase(),
          lastModified: new Date().toISOString(),
          version: originalData.version + 1
        };
        hasChanges = true;
        
        this.originalContent.set(elementId, {
          content: newContent,
          lastModified: new Date().toISOString(),
          version: originalData.version + 1
        });
      }
    });
    
    // Remove contenteditable
    this.editableElements.forEach(element => {
      element.removeAttribute('contenteditable');
      element.classList.remove('edit-mode');
    });
    
    if (hasChanges) {
      try {
        this.changeHistory.push(previousState);
        await this.saveContentToFirebase(updatedContent);
        this.showNotification('Changes saved successfully!', 'success');
        if (this.undoButton) {
          this.undoButton.style.display = 'flex';
        }
      } catch (error) {
        console.error('Error saving changes:', error);
        this.showNotification('Error saving changes: ' + error.message, 'error');
        this.revertChanges(updatedContent);
      }
    }

    this.unsavedChanges.clear();
  }

  revertChanges(updatedContent) {
    this.editableElements.forEach(element => {
      const originalData = this.originalContent.get(element.id);
      if (updatedContent[element.id]) {
        element.innerHTML = originalData.content;
        this.originalContent.set(element.id, {
          content: originalData.content,
          lastModified: originalData.lastModified,
          version: originalData.version
        });
      }
    });
  }

  async loadSavedContent() {
    try {
      console.log("Loading saved content...");
      const contentRef = doc(db, "site_content", "editable_content");
      
      let docSnap;
      try {
        docSnap = await getDoc(contentRef);
      } catch (error) {
        console.error("Error accessing content:", error);
        const cachedContent = localStorage.getItem('site_content');
        if (cachedContent) {
          docSnap = { 
            exists: () => true, 
            data: () => JSON.parse(cachedContent)
          };
          console.log("Using cached content from localStorage");
        } else {
          console.log("No cached content available");
          return;
        }
      }
      
      if (docSnap.exists() && docSnap.data().content) {
        console.log("Found saved content:", docSnap.data());
        const savedContent = docSnap.data().content;
        
        // Cache content
        try {
          localStorage.setItem('site_content', JSON.stringify(docSnap.data()));
        } catch (error) {
          console.warn("Could not cache content:", error);
        }
        
        // Update elements that have matching IDs
        this.editableElements.forEach(element => {
          const elementContent = savedContent[element.id];
          if (elementContent && elementContent.content) {
            // Verify element position matches saved position
            const currentPosition = {
              tag: element.tagName.toLowerCase(),
              parentTag: element.parentElement.tagName.toLowerCase(),
              parentClass: element.parentElement.classList[0] || '',
              index: Array.from(element.parentElement.children)
                .filter(el => el.tagName === element.tagName && el.classList.contains('editable'))
                .indexOf(element)
            };
            
            // Only update if position matches
            if (JSON.stringify(currentPosition) === JSON.stringify(elementContent.position)) {
              element.innerHTML = elementContent.content;
              this.originalContent.set(element.id, {
                content: elementContent.content,
                lastModified: elementContent.lastModified,
                version: elementContent.version,
                position: elementContent.position
              });
            }
          }
        });
      }
    } catch (error) {
      console.error("Error loading content:", error);
    } finally {
      await new Promise(resolve => setTimeout(resolve, 500));
      this.hideLoadingScreen();
    }
  }

  async saveContentToFirebase(updatedContent) {
    console.log("Saving content to Firebase:", updatedContent);
    
    const contentRef = doc(db, "site_content", "editable_content");
    
    try {
      const docSnap = await getDoc(contentRef);
      
      if (docSnap.exists()) {
        const currentContent = docSnap.data().content || {};
        const mergedContent = { ...currentContent };
        
        // Update only the changed elements by their IDs
        Object.entries(updatedContent).forEach(([elementId, value]) => {
          const element = document.getElementById(elementId);
          if (element) {
            // Include position information in saved content
            mergedContent[elementId] = {
              ...value,
              position: {
                tag: element.tagName.toLowerCase(),
                parentTag: element.parentElement.tagName.toLowerCase(),
                parentClass: element.parentElement.classList[0] || '',
                index: Array.from(element.parentElement.children)
                  .filter(el => el.tagName === element.tagName && el.classList.contains('editable'))
                  .indexOf(element)
              }
            };
          }
        });
        
        // Save to Firebase
        await updateDoc(contentRef, {
          content: mergedContent,
          lastUpdated: new Date().toISOString()
        });
        
        // Update cache
        try {
          localStorage.setItem('site_content', JSON.stringify({
            content: mergedContent,
            lastUpdated: new Date().toISOString()
          }));
        } catch (error) {
          console.warn("Could not cache content:", error);
        }
      } else {
        // Similar changes for new content
        const newContentWithPosition = {};
        Object.entries(updatedContent).forEach(([elementId, value]) => {
          const element = document.getElementById(elementId);
          if (element) {
            newContentWithPosition[elementId] = {
              ...value,
              position: {
                tag: element.tagName.toLowerCase(),
                parentTag: element.parentElement.tagName.toLowerCase(),
                parentClass: element.parentElement.classList[0] || '',
                index: Array.from(element.parentElement.children)
                  .filter(el => el.tagName === element.tagName && el.classList.contains('editable'))
                  .indexOf(element)
              }
            };
          }
        });
        
        const newContent = {
          content: newContentWithPosition,
          lastUpdated: new Date().toISOString()
        };
        
        await setDoc(contentRef, newContent);
        
        try {
          localStorage.setItem('site_content', JSON.stringify(newContent));
        } catch (error) {
          console.warn("Could not cache content:", error);
        }
      }
    } catch (error) {
      console.error("Error saving content:", error);
      throw error;
    }
  }

  showNotification(message, type) {
    let notification = document.getElementById('edit-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'edit-notification';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '4px';
      notification.style.color = 'white';
      notification.style.fontWeight = 'bold';
      notification.style.zIndex = '10000';
      notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
      document.body.appendChild(notification);
    }
    
    if (type === 'success') {
      notification.style.backgroundColor = '#4CAF50';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#F44336';
    }
    
    notification.textContent = message;
    notification.style.display = 'block';
    
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }
} 
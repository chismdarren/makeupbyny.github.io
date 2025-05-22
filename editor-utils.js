// Import Firebase modules
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db, auth, isAdminUser } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

export class ContentEditor {
  constructor() {
    this.editButton = document.getElementById('edit-mode-toggle');
    this.editableElements = document.querySelectorAll('.editable');
    this.editModeActive = false;
    // Use WeakMap to store element-specific content
    this.originalContent = new WeakMap();
    this.unsavedChanges = new WeakMap();
    this.changeHistory = [];
    
    // Track when loading screen was shown
    this.loadingStartTime = Date.now();
    // Minimum time to show loading screen (2.5 seconds)
    this.minLoadingTime = 2500;
    
    // Create loading screen
    this.createLoadingScreen();
    
    console.log('Found editable elements:', this.editableElements.length);
    
    // Initialize original content
    this.editableElements.forEach(element => {
      // Hide all editable elements initially
      element.style.opacity = '0';
      
      // Store the original content using the element itself as the key
      this.originalContent.set(element, {
        content: element.innerHTML,
        lastModified: new Date().toISOString(),
        version: 1,
        // Store a unique identifier for Firebase storage
        elementId: this.generateElementId(element)
      });

      // Add input event listener to track changes
      element.addEventListener('input', () => {
        if (this.editModeActive) {
          // Store changes specific to this element
          this.unsavedChanges.set(element, {
            content: element.innerHTML,
            elementId: this.generateElementId(element)
          });
          console.log('Change tracked for element:', this.generateElementId(element));
        }
      });
    });

    // Set up auth state listener for edit button visibility
    this.setupAuthListener();

    // Bind event listeners
    this.initializeEventListeners();
    this.loadSavedContent();
  }

  // Generate a unique identifier for an element based on its characteristics
  generateElementId(element) {
    const path = this.getElementPath(element);
    const content = element.innerHTML.trim().substring(0, 20); // Use first 20 chars of content
    const hash = this.simpleHash(content); // Create a simple hash of the content
    return `${path}-${hash}`;
  }

  // Simple hash function for content
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 6);
  }

  getElementPath(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body) {
      let identifier = current.tagName.toLowerCase();
      if (current.id) {
        identifier += `#${current.id}`;
      } else if (current.className) {
        identifier += `.${current.className.split(' ').join('.')}`;
      }
      
      // Add position among siblings
      const siblings = Array.from(current.parentNode?.children || []);
      const index = siblings.indexOf(current);
      identifier += `:nth-child(${index + 1})`;
      
      path.unshift(identifier);
      current = current.parentNode;
    }
    
    return path.join(' > ');
  }

  async saveContentToFirebase(updatedElement) {
    if (!updatedElement) return;

    try {
      const originalData = this.originalContent.get(updatedElement);
      if (!originalData) return;

      const elementId = originalData.elementId;
      const contentRef = doc(db, 'content', 'page-content');
      
      // Get existing content first
      const docSnap = await getDoc(contentRef);
      const existingContent = docSnap.exists() ? docSnap.data() : {};
      
      // Update only the specific element's content
      const updatedContent = {
        ...existingContent,
        [elementId]: {
          content: updatedElement.innerHTML,
          elementType: updatedElement.tagName.toLowerCase(),
          lastModified: new Date().toISOString(),
          version: (originalData.version || 0) + 1
        }
      };

      await setDoc(contentRef, updatedContent);
      
      // Update original content after successful save
      this.originalContent.set(updatedElement, {
        ...originalData,
        content: updatedElement.innerHTML,
        lastModified: new Date().toISOString(),
        version: (originalData.version || 0) + 1
      });

      // Clear unsaved changes for this element
      this.unsavedChanges.delete(updatedElement);
      
      console.log(`Saved content for element ${elementId}`);
      this.showNotification('Content saved successfully', 'success');
    } catch (error) {
      console.error('Error saving content:', error);
      this.showNotification('Error saving content', 'error');
    }
  }

  async loadSavedContent() {
    try {
      const contentRef = doc(db, 'content', 'page-content');
      const docSnap = await getDoc(contentRef);
      
      if (!docSnap.exists()) {
        console.log('No saved content found');
        this.hideLoadingScreen();
        return;
      }

      const savedContent = docSnap.data();
      
      // Update each element if it has saved content
      this.editableElements.forEach(element => {
        const originalData = this.originalContent.get(element);
        if (!originalData) return;

        const elementId = originalData.elementId;
        const savedElementContent = savedContent[elementId];
        
        if (savedElementContent) {
          element.innerHTML = savedElementContent.content;
          this.originalContent.set(element, {
            ...originalData,
            content: savedElementContent.content,
            lastModified: savedElementContent.lastModified,
            version: savedElementContent.version
          });
        }
      });

      this.hideLoadingScreen();
    } catch (error) {
      console.error('Error loading content:', error);
      this.hideLoadingScreen();
    }
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
        const originalData = this.originalContent.get(element);
        if (!originalData) return;
        
        const previousState = lastChange[originalData.elementId];
        
        if (previousState) {
          console.log(`Reverting ${originalData.elementId} to:`, previousState);
          element.innerHTML = previousState.content;
          
          // Update original content map
          this.originalContent.set(element, {
            ...previousState,
            elementId: originalData.elementId // Preserve the element ID
          });
          
          // Save this element's reverted state
          this.saveContentToFirebase(element);
        } else {
          console.log(`No previous state found for ${originalData.elementId}`);
        }
      });

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
    
    console.log('Starting save process...');
    console.log('Unsaved changes:', Array.from(this.unsavedChanges.entries()));
    
    // Store the previous state before making changes
    const previousState = {};
    this.editableElements.forEach(element => {
      const originalData = this.originalContent.get(element);
      if (originalData) {
        previousState[originalData.elementId] = { ...originalData };
      }
    });
    
    // Process all changes at once
    this.unsavedChanges.forEach((newData, element) => {
      const originalData = this.originalContent.get(element);
      
      console.log('\nChecking element:', originalData?.elementId);
      console.log('Current content:', newData.content);
      console.log('Original content:', originalData?.content);
      
      if (!originalData) {
        console.warn(`No original data found for element`);
        return;
      }
      
      if (newData.content !== originalData.content) {
        console.log('Content changed!');
        console.log('Old version:', originalData.version);
        console.log('New version:', originalData.version + 1);
        
        updatedContent[originalData.elementId] = {
          content: newData.content,
          elementType: element.tagName.toLowerCase(),
          lastModified: new Date().toISOString(),
          version: originalData.version + 1
        };
        hasChanges = true;
        
        this.originalContent.set(element, {
          ...originalData,
          content: newData.content,
          lastModified: new Date().toISOString(),
          version: originalData.version + 1
        });
      }
    });
    
    // Remove contenteditable from all elements
    this.editableElements.forEach(element => {
      element.removeAttribute('contenteditable');
      element.classList.remove('edit-mode');
    });
    
    if (hasChanges) {
      console.log('\nSaving changes to Firebase:', updatedContent);
      try {
        // Store the previous state for undo
        console.log('Storing previous state for undo:', previousState);
        this.changeHistory.push(previousState);
        
        // Save each updated element individually
        for (const [elementId, content] of Object.entries(updatedContent)) {
          await this.saveContentToFirebase(
            Array.from(this.editableElements).find(el => 
              this.originalContent.get(el)?.elementId === elementId
            )
          );
        }
        
        console.log('Changes saved successfully!');
        this.showNotification('Changes saved successfully!', 'success');
        
        // Show undo button
        if (this.undoButton) {
          this.undoButton.style.display = 'flex';
        }
      } catch (error) {
        console.error('Error saving changes:', error);
        this.showNotification('Error saving changes: ' + error.message, 'error');
        
        // Revert changes on error
        this.revertChanges(updatedContent);
      }
    } else {
      console.log('No changes to save');
    }

    // Clear unsaved changes after saving
    this.unsavedChanges.clear();
  }

  revertChanges(updatedContent) {
    this.editableElements.forEach(element => {
      const originalData = this.originalContent.get(element);
      if (!originalData) return;
      
      if (updatedContent[originalData.elementId]) {
        element.innerHTML = originalData.content;
        // No need to update originalContent as it wasn't changed yet
      }
    });
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
// Import Firebase modules
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

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
    
    // Initialize original content
    this.editableElements.forEach(element => {
      // Hide all editable elements initially
      element.style.opacity = '0';
      
      const elementId = this.getElementPath(element);
      console.log('Initializing element:', elementId, 'with content:', element.innerHTML);
      
      // Store the original content
      this.originalContent.set(elementId, {
        content: element.innerHTML,
        lastModified: new Date().toISOString(),
        version: 1
      });

      // Add input event listener to track changes
      element.addEventListener('input', () => {
        if (this.editModeActive) {
          this.unsavedChanges.set(elementId, element.innerHTML);
          console.log('Change tracked:', elementId, element.innerHTML);
        }
      });
    });

    // Log the original content map
    console.log('Original content map:', Object.fromEntries(this.originalContent));

    // Bind event listeners
    this.initializeEventListeners();
    this.loadSavedContent();
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
        const elementId = this.getElementPath(element);
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
        const elementId = this.getElementPath(element);
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
    
    this.editableElements.forEach(element => {
      element.setAttribute('contenteditable', 'true');
      element.classList.add('edit-mode');
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
    console.log('Unsaved changes:', Object.fromEntries(this.unsavedChanges));
    
    // Store the previous state before making changes
    const previousState = {};
    this.editableElements.forEach(element => {
      const elementId = this.getElementPath(element);
      const originalData = this.originalContent.get(elementId);
      if (originalData) {
        previousState[elementId] = { ...originalData };
      }
    });
    
    // Process all changes at once
    this.unsavedChanges.forEach((newContent, elementId) => {
      const originalData = this.originalContent.get(elementId);
      
      console.log('\nChecking element:', elementId);
      console.log('Current content:', newContent);
      console.log('Original content:', originalData?.content);
      
      if (!originalData) {
        console.warn(`No original data found for element ${elementId}`);
        return;
      }
      
      if (newContent !== originalData.content) {
        console.log('Content changed!');
        console.log('Old version:', originalData.version);
        console.log('New version:', originalData.version + 1);
        
        updatedContent[elementId] = {
          content: newContent,
          elementType: document.querySelector(elementId.split(':')[0]).tagName.toLowerCase(),
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
        
        await this.saveContentToFirebase(updatedContent);
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
      const elementId = this.getElementPath(element);
      const originalData = this.originalContent.get(elementId);
      if (updatedContent[elementId]) {
        element.innerHTML = originalData.content;
        this.originalContent.set(elementId, {
          content: originalData.content,
          lastModified: originalData.lastModified,
          version: originalData.version
        });
      }
    });
  }

  getElementPath(element) {
    const tagName = element.tagName.toLowerCase();
    const classList = Array.from(element.classList).filter(cls => cls !== 'edit-mode');
    const classNames = classList.join('.');
    
    const parentElement = element.parentElement;
    const parentTagName = parentElement ? parentElement.tagName.toLowerCase() : '';
    const parentClass = parentElement && parentElement.className ? 
      Array.from(parentElement.classList)[0] : '';
    
    const position = Array.from(parentElement.children).indexOf(element);
    
    const path = `${parentTagName}${parentClass ? '.' + parentClass : ''}>${tagName}.${classNames}:${position}`;
    console.log('Generated path for element:', path);
    return path;
  }

  async loadSavedContent() {
    try {
      console.log("Loading saved content...");
      const contentRef = doc(db, "site_content", "editable_content");
      const docSnap = await getDoc(contentRef);
      
      if (docSnap.exists() && docSnap.data().content) {
        console.log("Found saved content:", docSnap.data());
        const savedContent = docSnap.data().content;
        
        // Update all elements with saved content
        const updatePromises = Array.from(this.editableElements).map(async element => {
          // Get both the full path and the class-based path
          const fullPath = this.getElementPath(element);
          const classPath = this.getElementClassPath(element);
          
          console.log(`Checking paths for element:`, {
            fullPath,
            classPath
          });
          
          // Check if we have content for either path
          const contentMatch = savedContent[fullPath] || savedContent[classPath];
          
          if (contentMatch && contentMatch.content) {
            console.log(`Updating element with path ${fullPath} using content from:`, contentMatch);
            element.innerHTML = contentMatch.content;
            
            // Update original content map with saved version
            this.originalContent.set(fullPath, {
              content: contentMatch.content,
              lastModified: contentMatch.lastModified,
              version: contentMatch.version
            });
          } else {
            console.log(`No saved content found for paths ${fullPath} or ${classPath}, keeping original content`);
          }
        });

        await Promise.all(updatePromises);
      } else {
        console.log("No saved content found, keeping original content");
      }
    } catch (error) {
      console.error("Error loading saved content:", error);
    } finally {
      // Ensure all content updates are complete before hiding loading screen
      await new Promise(resolve => setTimeout(resolve, 500));
      this.hideLoadingScreen();
    }
  }

  getElementClassPath(element) {
    // Get the element's classes that we want to match across pages
    const relevantClasses = Array.from(element.classList)
      .filter(cls => ['editable', 'about-intro', 'about-description'].includes(cls))
      .sort() // Sort to ensure consistent order
      .join('.');
    
    // Create a path based on the element type and relevant classes
    return `${element.tagName.toLowerCase()}.${relevantClasses}`;
  }

  async saveContentToFirebase(updatedContent) {
    console.log("Saving content to Firebase:", updatedContent);
    
    const contentRef = doc(db, "site_content", "editable_content");
    
    try {
      const docSnap = await getDoc(contentRef);
      
      if (docSnap.exists()) {
        const currentContent = docSnap.data().content || {};
        
        // Merge the updated content with existing content
        const mergedContent = { ...currentContent };
        
        // For each updated element, save both its full path and class path
        Object.entries(updatedContent).forEach(([fullPath, value]) => {
          mergedContent[fullPath] = value;
          
          // Also save under the class path for cross-page sync
          const element = document.querySelector(fullPath.split(':')[0]);
          if (element) {
            const classPath = this.getElementClassPath(element);
            mergedContent[classPath] = value;
          }
        });
        
        console.log("Merging with existing content. Final content:", mergedContent);
        
        return await updateDoc(contentRef, {
          content: mergedContent,
          lastUpdated: new Date().toISOString()
        });
      } else {
        return await setDoc(contentRef, {
          content: updatedContent,
          lastUpdated: new Date().toISOString()
        });
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
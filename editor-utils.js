// Import Firebase modules
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

export class ContentEditor {
  constructor() {
    this.editButton = document.getElementById('edit-mode-toggle');
    this.editableElements = document.querySelectorAll('.editable');
    this.editModeActive = false;
    this.originalContent = new Map();
    this.changeHistory = []; // Store history of changes
    
    console.log('Found editable elements:', this.editableElements.length);
    
    // Initialize original content
    this.editableElements.forEach(element => {
      const elementId = this.getElementPath(element);
      console.log('Initializing element:', elementId, 'with content:', element.innerHTML);
      
      // Store the original content
      this.originalContent.set(elementId, {
        content: element.innerHTML,
        lastModified: new Date().toISOString(),
        version: 1
      });
    });

    // Log the original content map
    console.log('Original content map:', Object.fromEntries(this.originalContent));

    // Bind event listeners
    this.initializeEventListeners();
    this.loadSavedContent();
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

      // Save to Firebase
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

      console.log('Saving reverted content to Firebase:', revertedContent);
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
  }

  async exitEditMode() {
    this.editButton.classList.remove('active');
    this.editButton.innerHTML = '<i class="fas fa-pencil-alt"></i>';
    
    const updatedContent = {};
    let hasChanges = false;
    
    console.log('Starting save process...');
    
    // Store the previous state before making changes
    const previousState = {};
    this.editableElements.forEach(element => {
      const elementId = this.getElementPath(element);
      const originalData = this.originalContent.get(elementId);
      if (originalData) {
        previousState[elementId] = { ...originalData };
      }
    });
    
    this.editableElements.forEach(element => {
      const elementId = this.getElementPath(element);
      const currentContent = element.innerHTML;
      const originalData = this.originalContent.get(elementId);
      
      console.log('\nChecking element:', elementId);
      console.log('Current content:', currentContent);
      console.log('Original content:', originalData?.content);
      
      // Skip if we don't have original data for this element
      if (!originalData) {
        console.warn(`No original data found for element ${elementId}`);
        return;
      }
      
      if (currentContent !== originalData.content) {
        console.log('Content changed!');
        console.log('Old version:', originalData.version);
        console.log('New version:', originalData.version + 1);
        
        updatedContent[elementId] = {
          content: currentContent,
          elementType: element.tagName.toLowerCase(),
          lastModified: new Date().toISOString(),
          version: originalData.version + 1
        };
        hasChanges = true;
        
        this.originalContent.set(elementId, {
          content: currentContent,
          lastModified: new Date().toISOString(),
          version: originalData.version + 1
        });
      } else {
        console.log('No changes detected for this element');
      }
      
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

  async saveContentToFirebase(updatedContent) {
    console.log("Saving content to Firebase:", updatedContent);
    
    const contentRef = doc(db, "site_content", "editable_content");
    
    try {
      const docSnap = await getDoc(contentRef);
      
      if (docSnap.exists()) {
        const currentContent = docSnap.data().content || {};
        
        const mergedContent = { ...currentContent };
        Object.entries(updatedContent).forEach(([key, value]) => {
          if (!mergedContent[key] || !mergedContent[key].version || 
              value.version > mergedContent[key].version) {
            mergedContent[key] = value;
          }
        });
        
        return updateDoc(contentRef, {
          content: mergedContent,
          lastUpdated: new Date().toISOString()
        });
      } else {
        return setDoc(contentRef, {
          content: updatedContent,
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error saving content:", error);
      throw error;
    }
  }

  async loadSavedContent() {
    try {
      console.log("Loading saved content...");
      const contentRef = doc(db, "site_content", "editable_content");
      const docSnap = await getDoc(contentRef);
      
      if (docSnap.exists() && docSnap.data().content) {
        console.log("Found saved content:", docSnap.data());
        const savedContent = docSnap.data().content;
        
        this.editableElements.forEach(element => {
          const elementId = this.getElementPath(element);
          
          if (savedContent[elementId] && savedContent[elementId].content) {
            console.log(`Updating element with path ${elementId}`);
            element.innerHTML = savedContent[elementId].content;
            
            // Update original content map with saved version
            this.originalContent.set(elementId, {
              content: savedContent[elementId].content,
              lastModified: savedContent[elementId].lastModified,
              version: savedContent[elementId].version
            });
          } else {
            console.log(`No saved content found for ${elementId}, keeping original content`);
          }
        });
      } else {
        console.log("No saved content found, keeping original content");
      }
    } catch (error) {
      console.error("Error loading saved content:", error);
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
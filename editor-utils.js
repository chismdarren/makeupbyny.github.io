// Import Firebase modules
import { doc, setDoc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

export class ContentEditor {
  constructor() {
    this.editButton = document.getElementById('edit-mode-toggle');
    this.editableElements = document.querySelectorAll('.editable');
    this.editModeActive = false;
    this.originalContent = new Map();
    
    // Initialize original content
    this.editableElements.forEach(element => {
      const elementId = this.getElementPath(element);
      this.originalContent.set(elementId, {
        content: element.innerHTML,
        lastModified: new Date().toISOString(),
        version: 1
      });
    });

    // Bind event listeners
    this.initializeEventListeners();
    this.loadSavedContent();
  }

  initializeEventListeners() {
    // Only set up edit button if it exists and is visible
    if (this.editButton && this.editButton.style.display !== 'none') {
      this.editButton.addEventListener('click', () => this.toggleEditMode());
    }
  }

  toggleEditMode() {
    this.editModeActive = !this.editModeActive;
    
    if (this.editModeActive) {
      this.enterEditMode();
    } else {
      this.exitEditMode();
    }
  }

  enterEditMode() {
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
    
    this.editableElements.forEach(element => {
      const elementId = this.getElementPath(element);
      const currentContent = element.innerHTML;
      const originalData = this.originalContent.get(elementId);
      
      if (currentContent !== originalData.content) {
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
      }
      
      element.removeAttribute('contenteditable');
      element.classList.remove('edit-mode');
    });
    
    if (hasChanges) {
      try {
        await this.saveContentToFirebase(updatedContent);
        this.showNotification('Changes saved successfully!', 'success');
      } catch (error) {
        this.showNotification('Error saving changes: ' + error.message, 'error');
        console.error('Error saving changes:', error);
        
        // Revert changes on error
        this.revertChanges(updatedContent);
      }
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
    const classList = Array.from(element.classList);
    const classNames = classList.join('.');
    
    const parentElement = element.parentElement;
    const parentTagName = parentElement ? parentElement.tagName.toLowerCase() : '';
    const parentClass = parentElement && parentElement.className ? 
      Array.from(parentElement.classList)[0] : '';
    
    const position = Array.from(parentElement.children).indexOf(element);
    
    return `${parentTagName}${parentClass ? '.' + parentClass : ''}>${tagName}.${classNames}:${position}`;
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
// Import the about me functions
import { loadAboutMe, saveAboutMe } from './about-me.js';

// ... existing code ...

// Add event listener for edit mode toggle
document.addEventListener('DOMContentLoaded', function() {
  const editModeToggle = document.getElementById('edit-mode-toggle');
  let isEditMode = false;

  if (editModeToggle) {
    editModeToggle.addEventListener('click', async function() {
      isEditMode = !isEditMode;
      
      // Toggle edit mode UI
      editModeToggle.classList.toggle('active');
      editModeToggle.innerHTML = isEditMode ? 
        '<i class="fas fa-save"></i>' : 
        '<i class="fas fa-pencil-alt"></i>';
      
      const editableElements = document.querySelectorAll('.editable');
      
      if (isEditMode) {
        // Enter edit mode
        editableElements.forEach(element => {
          element.setAttribute('contenteditable', 'true');
          element.classList.add('edit-mode');
        });
      } else {
        // Exit edit mode and save changes
        editableElements.forEach(element => {
          element.removeAttribute('contenteditable');
          element.classList.remove('edit-mode');
        });
        
        // Get the about me paragraphs
        const aboutMeParagraphs = document.querySelectorAll('.about-me p');
        if (aboutMeParagraphs.length >= 2) {
          const mainText = aboutMeParagraphs[0].innerHTML;
          const subText = aboutMeParagraphs[1].innerHTML;
          
          // Save the changes
          const success = await saveAboutMe(mainText, subText);
          
          if (success) {
            showNotification('Changes saved successfully!', 'success');
          } else {
            showNotification('Error saving changes. Please try again.', 'error');
          }
        }
      }
    });
  }
  
  // Load about me content
  loadAboutMe();
});

// Notification function
function showNotification(message, type) {
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
  
  notification.style.backgroundColor = type === 'success' ? '#4CAF50' : '#F44336';
  notification.textContent = message;
  notification.style.display = 'block';
  
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
} 
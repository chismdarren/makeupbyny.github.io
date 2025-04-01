// Import Firebase Authentication functions and auth from firebase-config.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth, app } from "./firebase-config.js";

// Import Firestore functions
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Import Firebase Storage functions
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Initialize Firestore and Storage
const db = getFirestore();
const storage = getStorage(app, "makeupbyny-1.firebasestorage.app");

// Hardcoded admin UID
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Initialize SunEditor
let editor;

// Autosave variables
let autosaveTimeout;
const AUTOSAVE_DELAY = 2000; // 2 seconds

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing event listeners...");

  // Initialize main content SunEditor
  if (document.getElementById('content')) {
    editor = SUNEDITOR.create('content', {
      buttonList: [
        ['undo', 'redo'],
        ['font', 'fontSize', 'formatBlock'],
        ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
        ['removeFormat', 'blockquote'],
        ['fontColor', 'hiliteColor'],
        ['indent', 'outdent'],
        ['align', 'horizontalRule', 'list', 'lineHeight'],
        ['table', 'link', 'image', 'video', 'audio', 'fullScreen'],
      ],
      formats: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      font: [
        'Arial',
        'Calibri',
        'Comic Sans',
        'Courier',
        'Garamond',
        'Georgia',
        'Impact',
        'Lucida Console',
        'Tahoma',
        'Times New Roman',
        'Trebuchet MS',
        'Verdana',
        'Dancing Script',
        'Great Vibes',
        'Pacifico',
        'Satisfy',
        'Allura',
        'Brush Script MT',
        'Monsieur La Doulaise',
        'Tangerine',
        'Alex Brush',
        'Pinyon Script'
      ],
      fontSize: [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72],
      height: '400px',
      width: '100%',
      minHeight: '300px',
      maxHeight: '800px',
      callbacks: {
        onChange: function(contents) {
          // Update preview content directly with the HTML content from SunEditor
          const preview = document.getElementById('preview');
          if (preview) {
            // Update content
            const bodyElement = preview.querySelector('.preview-body');
            if (bodyElement) {
              bodyElement.innerHTML = contents || 'Post content preview will appear here...';
            }
            
            // Also update other elements to keep everything in sync
            // Update title
            const titleElement = preview.querySelector('.preview-title');
            const titleContent = document.getElementById('titleField') ? document.getElementById('titleField').innerHTML : '';
            const titleFont = document.getElementById('titleFont') ? document.getElementById('titleFont').value : '';
            
            if (titleElement) {
              titleElement.innerHTML = titleContent || 'Post Title';
              if (titleFont) {
                titleElement.style.fontFamily = titleFont;
              }
            }
            
            // Update featured image
            const imageContainer = preview.querySelector('.preview-featured-image-container');
            const featuredImage = document.getElementById('image') ? document.getElementById('image').value : '';
            
            if (imageContainer) {
              if (featuredImage) {
                imageContainer.innerHTML = `<img src="${featuredImage}" alt="${titleContent}" class="preview-featured-image">`;
              } else {
                imageContainer.innerHTML = '';
              }
            }
          }
          
          // For autosave
          clearTimeout(autosaveTimeout);
          showAutosaveStatus();
          autosaveTimeout = setTimeout(autosave, AUTOSAVE_DELAY);
        },
        // Ensure preview updates after image insertion
        onImageUpload: async function(files, info, uploadHandler) {
          try {
            const file = files[0];
            const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            uploadHandler(url);
            // No need to call updatePreview here as onChange will be triggered
          } catch (error) {
            console.error('Error uploading image:', error);
            alert('Error uploading image. Please try again.');
          }
        },
        // Add an onload callback to ensure the editor is ready
        onLoad: function() {
          console.log("SunEditor loaded");
          // Initial preview update
          setTimeout(() => updatePreview(this.getContents()), 500);
        }
      }
    });
  }
  
  // Initialize title field event listeners
  const titleField = document.getElementById('titleField');
  const titleFontSelect = document.getElementById('titleFont');
  
  if (titleField && document.getElementById('title')) {
    const titleHiddenInput = document.getElementById('title');
    
    // Handle input in the title field
    titleField.addEventListener('input', function() {
      // Update hidden input for form submission
      titleHiddenInput.value = this.innerHTML;
      
      // Update the preview title
      updateTitlePreview(this.innerHTML);
      
      // Trigger autosave
      clearTimeout(autosaveTimeout);
      showAutosaveStatus();
      autosaveTimeout = setTimeout(autosave, AUTOSAVE_DELAY);
    });
    
    // Prevent line breaks in title field
    titleField.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        return false;
      }
    });
  }

  // Handle font changes for the title
  if (titleFontSelect && titleField) {
    // Set initial font style if saved in localStorage
    const savedFont = localStorage.getItem('title_font');
    if (savedFont) {
      titleField.style.fontFamily = savedFont;
      titleFontSelect.value = savedFont;
    }
    
    titleFontSelect.addEventListener('change', function() {
      const selectedFont = this.value;
      titleField.style.fontFamily = selectedFont;
      
      // Update preview title font
      const previewTitle = document.querySelector('.preview-title');
      if (previewTitle) {
        previewTitle.style.fontFamily = selectedFont;
      }
      
      // Save font preference
      localStorage.setItem('title_font', selectedFont);
      
      // Trigger autosave
      clearTimeout(autosaveTimeout);
      showAutosaveStatus();
      autosaveTimeout = setTimeout(autosave, AUTOSAVE_DELAY);
    });
  }

  // Initialize elements
  const postForm = document.getElementById("postForm");
  const contentEditor = document.getElementById("content");
  const imageInput = document.getElementById("image");
  const insertImageBtn = document.getElementById("insertImageBtn");
  const imageUploadInput = document.getElementById("imageUpload");
  const previewContent = document.getElementById("previewContent");

  // Add loading indicator
  function showLoading(element) {
    if (element) {
      element.style.opacity = '0.5';
      element.style.pointerEvents = 'none';
    }
  }

  function hideLoading(element) {
    if (element) {
      element.style.opacity = '1';
      element.style.pointerEvents = 'auto';
    }
  }

  // Add character count
  function updateCharacterCount() {
    if (!contentEditor) return;
    
    const content = contentEditor.innerHTML;
    const charCount = content.replace(/<[^>]*>/g, '').length;
    const charCountElement = document.getElementById('charCount');
    if (charCountElement) {
      charCountElement.textContent = `Character count: ${charCount}`;
    }
  }

  // Handle image removal
  function setupImageRemoval() {
    if (contentEditor) {
      contentEditor.addEventListener('click', function(e) {
        if (e.target.tagName === 'IMG') {
          if (confirm('Remove this image?')) {
            e.target.remove();
            updatePreview();
          }
        }
      });
    }
  }

  // Update preview
  function updatePreview(contents) {
    const preview = document.getElementById('preview');
    if (!preview) return;
    
    const bodyElement = preview.querySelector('.preview-body');
    if (bodyElement) {
      bodyElement.innerHTML = contents || 'Post content preview will appear here...';
    }
  }
  
  // Update title preview
  function updateTitlePreview(contents) {
    const preview = document.getElementById('preview');
    if (!preview) return;
    
    const titleElement = preview.querySelector('.preview-title');
    if (titleElement) {
      titleElement.innerHTML = contents || 'Post Title';
      
      // Apply the selected font to the preview title
      const titleFont = document.getElementById('titleFont');
      if (titleFont) {
        titleElement.style.fontFamily = titleFont.value;
      }
    }
  }

  // Text formatting functionality
  function setupTextFormatting() {
    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicBtn');
    const underlineBtn = document.getElementById('underlineBtn');
    const fontFamilySelect = document.getElementById('fontFamily');
    const fontSizeSelect = document.getElementById('fontSize');

    // Format buttons
    if (boldBtn) {
      boldBtn.addEventListener('click', () => {
        document.execCommand('bold', false, null);
        contentEditor.focus();
      });
    }
    
    if (italicBtn) {
      italicBtn.addEventListener('click', () => {
        document.execCommand('italic', false, null);
        contentEditor.focus();
      });
    }
    
    if (underlineBtn) {
      underlineBtn.addEventListener('click', () => {
        document.execCommand('underline', false, null);
        contentEditor.focus();
      });
    }
    
    // Font family
    if (fontFamilySelect) {
      fontFamilySelect.addEventListener('change', () => {
        document.execCommand('fontName', false, fontFamilySelect.value);
        contentEditor.focus();
      });
    }
    
    // Font size
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', () => {
        document.execCommand('fontSize', false, fontSizeSelect.value);
        contentEditor.focus();
      });
    }
  }

  // Handle image upload and preview
  function handleImageUpload(file) {
    return new Promise((resolve, reject) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        reject(new Error('File must be an image'));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Image must be less than 5MB'));
        return;
      }

      showLoading(contentEditor);
      showLoading(previewContent);

      // Create a temporary preview while uploading
      const tempId = Date.now();
      const tempImgHtml = `<div id="temp-${tempId}" class="image-uploading">
        <div class="upload-progress">Uploading... 0%</div>
        <img src="${URL.createObjectURL(file)}" alt="Uploading..." style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      </div>`;
      
      // Add temporary preview
      if (previewContent) {
        previewContent.innerHTML = tempImgHtml + previewContent.innerHTML;
      }
      if (contentEditor) {
        contentEditor.innerHTML = tempImgHtml + contentEditor.innerHTML;
      }

      // Compress image
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Calculate new dimensions (max 1200px width)
          let width = img.width;
          let height = img.height;
          if (width > 1200) {
            height = (height * 1200) / width;
            width = 1200;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(function(blob) {
            // Upload to Firebase Storage using uploadBytesResumable
            const imageRef = ref(storage, `images/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(imageRef, blob);
            
            uploadTask.on('state_changed',
              (snapshot) => {
                // Update progress
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                const progressElement = document.querySelector(`#temp-${tempId} .upload-progress`);
                if (progressElement) {
                  progressElement.textContent = `Uploading... ${Math.round(progress)}%`;
                }
              },
              (error) => {
                console.error('Upload error:', error);
                // Remove temporary preview on error
                const tempElement = document.querySelector(`#temp-${tempId}`);
                if (tempElement) {
                  tempElement.remove();
                }
                reject(error);
              },
              async () => {
                try {
                  // Get download URL
                  const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                  
                  // Replace temporary preview with final image
                  const finalImgHtml = `<img src="${downloadURL}" alt="Preview" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); cursor: pointer;" title="Click to edit image" data-image-id="${tempId}">`;
                  
                  // Update preview
                  if (previewContent) {
                    const tempElement = previewContent.querySelector(`#temp-${tempId}`);
                    if (tempElement) {
                      tempElement.outerHTML = finalImgHtml;
                    }
                  }
                  
                  // Update content editor
                  if (contentEditor) {
                    const tempElement = contentEditor.querySelector(`#temp-${tempId}`);
                    if (tempElement) {
                      tempElement.outerHTML = finalImgHtml;
                    }
                  }
                  
                  hideLoading(contentEditor);
                  hideLoading(previewContent);
                  resolve(downloadURL);
                } catch (error) {
                  console.error('Error getting download URL:', error);
                  // Remove temporary preview on error
                  const tempElement = document.querySelector(`#temp-${tempId}`);
                  if (tempElement) {
                    tempElement.remove();
                  }
                  reject(error);
                }
              }
            );
          }, 'image/jpeg', 0.8); // Compress to JPEG with 80% quality
        };
        img.onerror = () => {
          hideLoading(contentEditor);
          hideLoading(previewContent);
          reject(new Error('Error loading image'));
        };
        img.src = e.target.result;
      };
      reader.onerror = () => {
        hideLoading(contentEditor);
        hideLoading(previewContent);
        reject(new Error('Error reading file'));
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle image editing
  function setupImageEditing() {
    if (contentEditor) {
      contentEditor.addEventListener('click', function(e) {
        if (e.target.tagName === 'IMG') {
          const img = e.target;
          const action = prompt('What would you like to do?\n1. Remove image\n2. Edit alt text\n3. Change position\n4. Resize image\n5. Cancel');
          
          if (!action) return;
          
          switch(action) {
            case '1':
              if (confirm('Remove this image?')) {
                img.remove();
                updatePreview();
              }
              break;
              
            case '2':
              const altText = prompt('Enter alt text for the image:', img.alt);
              if (altText !== null) {
                img.alt = altText;
                updatePreview();
              }
              break;
              
            case '3':
              const position = prompt('Choose position:\n1. Left\n2. Center\n3. Right', '2');
              if (position) {
                switch(position) {
                  case '1':
                    img.style.float = 'left';
                    img.style.margin = '0 20px 10px 0';
                    break;
                  case '2':
                    img.style.float = 'none';
                    img.style.display = 'block';
                    img.style.margin = '10px auto';
                    break;
                  case '3':
                    img.style.float = 'right';
                    img.style.margin = '0 0 10px 20px';
                    break;
                }
                updatePreview();
              }
              break;
              
            case '4':
              const width = prompt('Enter new width in pixels (e.g., 300):', img.style.width);
              if (width) {
                img.style.width = width + 'px';
                img.style.height = 'auto';
                updatePreview();
              }
              break;
          }
        }
      });
    }
  }

  // Handle multiple image uploads
  function handleMultipleImages(files) {
    return Promise.all(Array.from(files).map(file => handleImageUpload(file)));
  }

  // Handle main image input
  if (imageInput) {
    imageInput.addEventListener("change", async function(event) {
      const files = event.target.files;
      if (files.length > 0) {
        try {
          await handleMultipleImages(files);
        } catch (error) {
          console.error("Error handling images:", error);
          alert(error.message || "Error processing images. Please try again.");
        }
      }
    });
  }

  // Handle image upload button
  if (insertImageBtn && imageUploadInput) {
    insertImageBtn.addEventListener("click", () => {
      imageUploadInput.click();
    });
    
    imageUploadInput.addEventListener("change", async function(event) {
      const files = event.target.files;
      if (files) {
        try {
          await handleMultipleImages(files);
        } catch (error) {
          console.error("Error handling images:", error);
          alert(error.message || "Error processing images. Please try again.");
        }
      }
    });
  }

  // Live update for content
  if (contentEditor) {
    contentEditor.addEventListener("input", function() {
      updatePreview();
      updateCharacterCount();
      saveDraft();
    });
  }

  // Live update for title
  const titleInput = document.getElementById("title");
  if (titleInput) {
    titleInput.addEventListener("input", function() {
      const previewTitle = document.getElementById("previewTitle");
      if (previewTitle) {
        previewTitle.textContent = this.value || "Post Title Preview";
      }
    });
  }

  // Live update for tags
  const tagsInput = document.getElementById("tags");
  if (tagsInput) {
    tagsInput.addEventListener("input", function() {
      const previewTags = document.getElementById("previewTags");
      if (previewTags) {
        previewTags.textContent = this.value ? `Tags: ${this.value}` : "";
      }
    });
  }

  // Live update for date
  const dateInput = document.getElementById("postDate");
  if (dateInput) {
    dateInput.addEventListener("change", function() {
      const previewDate = document.getElementById("previewDate");
      if (previewDate) {
        const selectedDate = new Date(this.value);
        previewDate.textContent = selectedDate.toLocaleDateString();
      }
    });

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    const previewDate = document.getElementById("previewDate");
    if (previewDate) {
      previewDate.textContent = new Date().toLocaleDateString();
    }
  }

  // Save draft functionality
  function saveDraft() {
    const draft = {
      title: document.getElementById("title").value,
      content: contentEditor.innerHTML,
      tags: document.getElementById("tags").value,
      status: document.querySelector('input[name="status"]:checked').value,
      date: document.getElementById("postDate").value,
      lastSaved: new Date().toISOString()
    };
    localStorage.setItem('postDraft', JSON.stringify(draft));
  }

  // Load draft functionality
  function loadDraft() {
    const draft = localStorage.getItem('postDraft');
    if (draft) {
      try {
        const parsedDraft = JSON.parse(draft);
        
        const titleElement = document.getElementById("title");
        const tagsElement = document.getElementById("tags");
        const statusElements = document.querySelectorAll('input[name="status"]');
        const dateElement = document.getElementById("postDate");
        
        if (titleElement) titleElement.value = parsedDraft.title || '';
        if (contentEditor) contentEditor.innerHTML = parsedDraft.content || '';
        if (tagsElement) tagsElement.value = parsedDraft.tags || '';
        
        // Only try to set radio button if it exists
        if (statusElements && statusElements.length > 0) {
          const statusValue = parsedDraft.status || 'draft';
          const statusElement = document.querySelector(`input[name="status"][value="${statusValue}"]`);
          if (statusElement) statusElement.checked = true;
        }
        
        if (dateElement) dateElement.value = parsedDraft.date || '';
        
        updatePreview();
        updateCharacterCount();
      } catch (error) {
        console.error('Error parsing draft:', error);
      }
    }
  }

  // Initialize
  setupTextFormatting();
  setupImageEditing();
  
  // Only try to load draft and update character count if we have the required elements
  if (contentEditor && document.getElementById("title")) {
    loadDraft();
    updateCharacterCount();
  }

  // Handle form submission
  if (document.getElementById('postForm')) {
    document.getElementById('postForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Get values from the form and editor
      const titleValue = document.getElementById('title') ? document.getElementById('title').value : '';
      const titleFont = document.getElementById('titleFont') ? document.getElementById('titleFont').value : '';
      const content = editor && editor.getContents ? editor.getContents() : '';
      const imageUrl = document.getElementById('image') ? document.getElementById('image').value : '';

      try {
        await addDoc(collection(db, "posts"), {
          title: titleValue,
          titleFont: titleFont,
          content: content,
          imageUrl: imageUrl,
          createdAt: new Date(),
        });

        // Clear all draft data after successful submission
        localStorage.removeItem('draft_title');
        localStorage.removeItem('draft_content');
        localStorage.removeItem('draft_title_font');
        localStorage.removeItem('draft_image_url');
        localStorage.removeItem('draft_timestamp');
        localStorage.removeItem('postDraft'); // Clear old format too
        
        alert('Post published successfully!');
        window.location.href = 'admin-dashboard.html';
      } catch (error) {
        console.error('Error publishing post:', error);
        alert('Error publishing post. Please try again.');
      }
    });
  }

  // Handle authentication state
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const createPostLink = document.getElementById("create-post-link");

  if (loginLink && logoutBtn && createPostLink) {
    onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed. Current user:", user ? user.uid : "No user");

      if (user) {
        loginLink.style.display = "none";
        logoutBtn.style.display = "block";
        createPostLink.style.display = "inline";
        // Load posts when user is logged in
        loadUserPosts();
      } else {
        loginLink.style.display = "block";
        logoutBtn.style.display = "none";
        createPostLink.style.display = "none";
        // Clear posts list when user logs out
        const postsList = document.getElementById('postsList');
        if (postsList) {
          postsList.innerHTML = '<p>Please log in to view your posts.</p>';
        }
      }
    });
  }

  // Handle logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
        console.log("User signed out.");
        window.location.href = "index.html";
      });
    });
  }

  // Add CSS for image upload state
  const style = document.createElement('style');
  style.textContent = `
    .image-uploading {
      position: relative;
      margin: 10px 0;
    }
    .upload-progress {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      z-index: 1;
    }
  `;
  document.head.appendChild(style);

  // Load user's posts
  loadUserPosts();

  // Load draft data
  function loadSavedDraft() {
    // Check for individual draft items (new format)
    const title = localStorage.getItem('draft_title');
    const content = localStorage.getItem('draft_content');
    const titleFont = localStorage.getItem('draft_title_font');
    const imageUrl = localStorage.getItem('draft_image_url');
    
    // Only proceed if we have saved draft data
    if (title || content || imageUrl) {
      console.log('Loading saved draft');
      
      // Set title content and font
      const titleField = document.getElementById('titleField');
      if (titleField && title) {
        titleField.innerHTML = title;
        
        // Also update the hidden input
        const titleInput = document.getElementById('title');
        if (titleInput) {
          titleInput.value = title;
        }
      }
      
      // Set title font if saved
      if (titleField && titleFont) {
        titleField.style.fontFamily = titleFont;
        const titleFontSelect = document.getElementById('titleFont');
        if (titleFontSelect) {
          titleFontSelect.value = titleFont;
        }
      }
      
      // Set content in editor
      if (editor && content) {
        editor.setContents(content);
      }
      
      // Set image URL and preview
      if (imageUrl) {
        const imageInput = document.getElementById('image');
        const imagePreview = document.getElementById('imagePreview');
        if (imageInput) {
          imageInput.value = imageUrl;
        }
        if (imagePreview) {
          imagePreview.innerHTML = `<img src="${imageUrl}" alt="Preview">`;
        }
      }
      
      // Update preview with loaded content
      updatePreview(content);
      return true;
    }
    
    // Check for older format draft
    const savedDraft = localStorage.getItem('postDraft');
    if (savedDraft && editor) {
      try {
        const draft = JSON.parse(savedDraft);
        
        // Set title content in the title field if it exists
        const titleField = document.getElementById('titleField');
        if (titleField && draft.title) {
          titleField.innerHTML = draft.title;
          
          // Also update the hidden input
          const titleInput = document.getElementById('title');
          if (titleInput) {
            titleInput.value = draft.title;
          }
          
          // Set font if saved
          if (draft.titleFont) {
            titleField.style.fontFamily = draft.titleFont;
            const titleFontSelect = document.getElementById('titleFont');
            if (titleFontSelect) {
              titleFontSelect.value = draft.titleFont;
            }
          }
        }
        
        if (editor && editor.setContents) {
          editor.setContents(draft.content || '');
        }
        if (document.getElementById('image')) {
          document.getElementById('image').value = draft.imageUrl || '';
        }
        if (draft.imageUrl && document.getElementById('imagePreview')) {
          document.getElementById('imagePreview').innerHTML = `<img src="${draft.imageUrl}" alt="Preview">`;
        }
        
        return true;
      } catch (error) {
        console.error('Error loading draft:', error);
        return false;
      }
    }
    
    return false;
  }

  // Call this function after DOM is loaded
  setTimeout(() => {
    loadSavedDraft();
  }, 500);
});

// Function to load and display user's posts
async function loadUserPosts() {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('No user logged in');
      return;
    }

    console.log('Loading posts for user:', user.uid);
    const postsList = document.getElementById('postsList');
    if (!postsList) {
      console.error('Posts list element not found');
      return;
    }

    // Show loading state
    postsList.innerHTML = '<p>Loading posts...</p>';

    // Get posts from Firestore
    const postsRef = collection(db, 'posts');
    console.log('Querying Firestore for posts...');
    // Temporarily remove the orderBy clause until the index is created
    const q = query(postsRef, where('userId', '==', user.uid));
    const querySnapshot = await getDocs(q);
    console.log('Query completed. Number of posts found:', querySnapshot.size);

    if (querySnapshot.empty) {
      console.log('No posts found for user:', user.uid);
      postsList.innerHTML = '<p>No posts found. Create your first post!</p>';
      return;
    }

    // Clear existing posts
    postsList.innerHTML = '';

    // Convert to array and sort in memory
    const posts = [];
    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() });
    });
    
    // Sort posts by createdAt in descending order
    posts.sort((a, b) => {
      const dateA = a.createdAt ? a.createdAt.seconds : 0;
      const dateB = b.createdAt ? b.createdAt.seconds : 0;
      return dateB - dateA;
    });

    // Add each post to the list
    posts.forEach((post) => {
      console.log('Processing post:', post.id, post);
      const postCard = createPostCard(post.id, post);
      postsList.appendChild(postCard);
    });
  } catch (error) {
    console.error('Error loading posts:', error);
    const postsList = document.getElementById('postsList');
    if (postsList) {
      postsList.innerHTML = '<p>Error loading posts. Please try again later.</p>';
    }
  }
}

// Function to create a post card element
function createPostCard(postId, post) {
  const card = document.createElement('div');
  card.className = 'post-card';
  card.setAttribute('data-post-id', postId);

  // Format date
  const postDate = post.createdAt ? new Date(post.createdAt.seconds * 1000) : new Date();
  const formattedDate = postDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create card content
  card.innerHTML = `
    <h3>${post.title || 'Untitled Post'}</h3>
    <div class="post-content">
      ${post.content || 'No content'}
    </div>
    <div class="post-meta">
      <span>${formattedDate}</span>
      <span class="status-badge status-${post.status || 'draft'}">${post.status || 'Draft'}</span>
    </div>
    <div class="post-actions">
      <button class="edit-btn" onclick="window.location.href='edit-post.html?postId=${postId}'">Edit</button>
      <button class="delete-btn" onclick="deletePost('${postId}')">Delete</button>
    </div>
  `;

  return card;
}

// Function to delete a post
async function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
    return;
  }

  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user logged in');
    }

    // Delete post from Firestore
    await deleteDoc(doc(db, 'posts', postId));
    
    // Remove post card from DOM
    const postCard = document.querySelector(`[data-post-id="${postId}"]`);
    if (postCard) {
      postCard.remove();
    }

    alert('Post deleted successfully!');
  } catch (error) {
    console.error('Error deleting post:', error);
    alert('Error deleting post. Please try again later.');
  }
}

// Image upload handling
const imageUpload = document.getElementById('imageUpload');
const uploadBtn = document.getElementById('uploadBtn');
const imagePreview = document.getElementById('imagePreview');
const imageUrlInput = document.getElementById('image');

if (uploadBtn) {
  uploadBtn.addEventListener('click', () => imageUpload.click());
}

if (imageUpload) {
  imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Show loading indicator
      if (imagePreview) {
        imagePreview.innerHTML = '<div class="loading-indicator">Uploading image...</div>';
      }
      
      const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      // Update the image URL input and preview
      if (imageUrlInput) {
        imageUrlInput.value = url;
      }
      
      if (imagePreview) {
        imagePreview.innerHTML = `<img src="${url}" alt="Preview">`;
      }
      
      // Trigger autosave and update preview
      if (editor) {
        // Make sure we're updating with the current content
        const currentContent = editor.getContents();
        updatePreview(currentContent);
        
        clearTimeout(autosaveTimeout);
        showAutosaveStatus();
        autosaveTimeout = setTimeout(autosave, AUTOSAVE_DELAY);
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image. Please try again.');
      if (imagePreview) {
        imagePreview.innerHTML = '<div class="error-message">Upload failed. Please try again.</div>';
      }
    }
  });
}

// Update image preview when URL is entered
if (imageUrlInput) {
  imageUrlInput.addEventListener('input', (e) => {
    const url = e.target.value;
    if (url && imagePreview) {
      imagePreview.innerHTML = `<img src="${url}" alt="Preview">`;
    } else if (imagePreview) {
      imagePreview.innerHTML = '';
    }
    
    // Trigger autosave and update preview
    if (editor) {
      // Make sure we're updating with the current content
      const currentContent = editor.getContents();
      updatePreview(currentContent);
      
      clearTimeout(autosaveTimeout);
      showAutosaveStatus();
      autosaveTimeout = setTimeout(autosave, AUTOSAVE_DELAY);
    }
  });
}

// Preview mode handling
const previewControls = document.querySelectorAll('.preview-control-btn');
const previewContent = document.getElementById('preview');

if (previewControls && previewContent) {
  previewControls.forEach(btn => {
    btn.addEventListener('click', () => {
      previewControls.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      previewContent.className = 'preview-content';
      previewContent.classList.add(`preview-${btn.dataset.view}`);
    });
  });
}

// Enhanced preview update function
function updatePreview(contents) {
  const preview = document.getElementById('preview');
  if (!preview) return;

  // Get the editor contents - ensure we're getting the actual content from SunEditor
  const content = contents !== undefined ? contents : (editor && editor.getContents ? editor.getContents() : '');
  const titleContent = document.getElementById('titleField') ? document.getElementById('titleField').innerHTML : '';
  const titleFont = document.getElementById('titleFont') ? document.getElementById('titleFont').value : '';
  const featuredImage = document.getElementById('image') ? document.getElementById('image').value : '';
  
  // Update preview elements
  const titleElement = preview.querySelector('.preview-title');
  const bodyElement = preview.querySelector('.preview-body');
  const dateElement = preview.querySelector('.preview-date');
  const imageContainer = preview.querySelector('.preview-featured-image-container');
  
  if (titleElement) {
    titleElement.innerHTML = titleContent || 'Post Title';
    if (titleFont) {
      titleElement.style.fontFamily = titleFont;
    }
  }
  
  if (bodyElement) {
    bodyElement.innerHTML = content || 'Post content preview will appear here...';
  }
  
  if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  
  // Update featured image
  if (imageContainer) {
    if (featuredImage) {
      imageContainer.innerHTML = `<img src="${featuredImage}" alt="${titleContent}" class="preview-featured-image">`;
    } else {
      imageContainer.innerHTML = '';
    }
  }
}

// Initialize preview when page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (editor) {
      updatePreview(editor.getContents());
    }
  }, 1000); // Give the editor time to initialize
});

// Autosave functionality
const autosaveStatus = document.getElementById('autosaveStatus');

function showAutosaveStatus() {
  autosaveStatus.classList.add('show');
}

function hideAutosaveStatus() {
  autosaveStatus.classList.remove('show');
}

async function autosave() {
  try {
    // Get content from editor
    const content = editor ? editor.getContents() : '';
    const titleContent = document.getElementById('titleField') ? document.getElementById('titleField').innerHTML : '';
    const titleFont = document.getElementById('titleFont') ? document.getElementById('titleFont').value : '';
    const imageUrl = document.getElementById('image') ? document.getElementById('image').value : '';
    
    // Update hidden title input if needed
    const titleInput = document.getElementById('title');
    if (titleInput) {
      titleInput.value = titleContent;
    }
    
    // Save to localStorage
    localStorage.setItem('draft_title', titleContent);
    localStorage.setItem('draft_content', content);
    localStorage.setItem('draft_title_font', titleFont);
    localStorage.setItem('draft_image_url', imageUrl);
    localStorage.setItem('draft_timestamp', Date.now());
    
    // Show autosave status
    showAutosaveStatus();
    
    // Hide status after 2 seconds
    setTimeout(hideAutosaveStatus, 2000);
    
    console.log('Autosaved draft');
  } catch (error) {
    console.error('Autosave error:', error);
  }
}

// Load recent posts
async function loadRecentPosts() {
  const recentPostsList = document.getElementById('recentPostsList');
  if (!recentPostsList) return;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    recentPostsList.innerHTML = "";
    
    querySnapshot.docs.slice(0, 5).forEach(doc => {
      const post = doc.data();
      const recentPostElement = document.createElement("a");
      recentPostElement.href = `post.html?postId=${doc.id}`;
      recentPostElement.className = "recent-post-item";
      
      const imageHtml = post.imageUrl 
        ? `<img src="${post.imageUrl}" alt="${post.title}">`
        : `<div style="width: 60px; height: 60px; background-color: #f0f0f0; border-radius: 8px;"></div>`;
      
      recentPostElement.innerHTML = `
        ${imageHtml}
        <div class="post-title">${post.title}</div>
      `;
      
      recentPostsList.appendChild(recentPostElement);
    });
  } catch (error) {
    console.error("Error loading recent posts:", error);
    recentPostsList.innerHTML = "<p>Error loading recent posts.</p>";
  }
}

// Load recent posts when page loads
document.addEventListener('DOMContentLoaded', loadRecentPosts); 
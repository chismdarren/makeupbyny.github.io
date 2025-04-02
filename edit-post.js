// Import Firebase Authentication functions and auth from firebase-config.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

// Import Firestore functions
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Import Firebase Storage functions
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Initialize Firestore and Storage
const db = getFirestore();
const storage = getStorage();

// Hardcoded admin UID
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing event listeners...");

  // Initialize elements
  const editPostForm = document.getElementById("editPostForm");
  const contentEditor = document.getElementById("content");
  const insertImageBtn = document.getElementById("insertImageBtn");
  const imageUploadInput = document.getElementById("imageUpload");
  const previewContent = document.getElementById("previewContent");
  const deletePostBtn = document.getElementById("deletePostBtn");

  // Get post ID from URL
  const params = new URLSearchParams(window.location.search);
  const currentPostId = params.get("postId");

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
    const content = contentEditor.innerHTML;
    const charCount = content.replace(/<[^>]*>/g, '').length;
    const charCountElement = document.getElementById('charCount');
    if (charCountElement) {
      charCountElement.textContent = `Character count: ${charCount}`;
    }
  }

  // Update preview
  function updatePreview() {
    if (previewContent && contentEditor) {
      previewContent.innerHTML = contentEditor.innerHTML || "Post content preview will appear here...";
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
            // Upload to Firebase Storage
            const imageRef = ref(storage, `images/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytes(imageRef, blob);
            
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
                reject(error);
              },
              async () => {
                try {
                  // Get download URL
                  const downloadURL = await getDownloadURL(imageRef);
                  
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
                  reject(error);
                }
              }
            );
          }, 'image/jpeg', 0.8); // Compress to JPEG with 80% quality
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
  }

  // Load post data
  async function loadPostData() {
    if (!currentPostId) {
      console.error("No post ID provided");
      alert("No post ID provided. Redirecting to home page...");
      window.location.href = "index.html";
      return;
    }

    try {
      showLoading(editPostForm);
      console.log("Loading post data for ID:", currentPostId);
      
      const postDocRef = doc(db, "posts", currentPostId);
      const postSnapshot = await getDoc(postDocRef);
      
      if (postSnapshot.exists()) {
        const postData = postSnapshot.data();
        console.log("Post data loaded:", postData);
        
        // Populate form fields
        const titleInput = document.getElementById("title");
        const tagsInput = document.getElementById("tags");
        const dateInput = document.getElementById("postDate");
        const statusInputs = document.querySelectorAll('input[name="status"]');
        
        if (titleInput) titleInput.value = postData.title || '';
        if (contentEditor) {
          contentEditor.innerHTML = postData.content || '';
          // Add image if it exists
          if (postData.imageUrl) {
            contentEditor.innerHTML += `<img src="${postData.imageUrl}" alt="Post image" style="max-width:100%; margin-top:10px;">`;
          }
        }
        if (tagsInput) tagsInput.value = postData.tags || '';
        if (dateInput) dateInput.value = postData.postDate || new Date().toISOString().split('T')[0];
        
        // Set status radio button
        if (statusInputs) {
          const status = postData.status || 'draft';
          statusInputs.forEach(input => {
            input.checked = input.value === status;
          });
        }
        
        // Update preview
        const previewTitle = document.getElementById("previewTitle");
        const previewContent = document.getElementById("previewContent");
        const previewTags = document.getElementById("previewTags");
        const previewDate = document.getElementById("previewDate");
        
        if (previewTitle) previewTitle.textContent = postData.title || "Post Title Preview";
        if (previewContent) {
          previewContent.innerHTML = postData.content || "Post content preview will appear here...";
          // Add image to preview if it exists
          if (postData.imageUrl) {
            previewContent.innerHTML += `<img src="${postData.imageUrl}" alt="Post image" style="max-width:100%; margin-top:10px;">`;
          }
        }
        if (previewTags) previewTags.textContent = postData.tags ? `Tags: ${postData.tags}` : '';
        if (previewDate) {
          const date = postData.postDate || postData.lastModified || postData.createdAt;
          previewDate.textContent = date ? new Date(date).toLocaleDateString() : '';
        }
        
        updateCharacterCount();
        console.log("Post data loaded successfully");
      } else {
        console.error("Post not found for ID:", currentPostId);
        alert("Post not found. Redirecting to home page...");
        window.location.href = "index.html";
      }
    } catch (error) {
      console.error("Error loading post:", error);
      alert("Error loading post data. Please try again or contact support if the problem persists.");
    } finally {
      hideLoading(editPostForm);
    }
  }

  // Handle form submission
  if (editPostForm) {
    editPostForm.addEventListener("submit", async function(event) {
      event.preventDefault();

      const title = document.getElementById("title").value;
      const content = contentEditor.innerHTML;
      const tags = document.getElementById("tags").value;
      const status = document.querySelector('input[name="status"]:checked').value;
      const postDate = document.getElementById("postDate").value;

      try {
        showLoading(editPostForm);
        await updateDoc(doc(db, "posts", currentPostId), {
          title: title.replace(/&nbsp;/g, ' '), // Replace &nbsp; with regular spaces
          content,
          tags,
          status,
          postDate,
          lastModified: serverTimestamp()
        });

        alert("Post updated successfully!");
        window.location.href = "index.html";
      } catch (error) {
        console.error("Error updating post:", error);
        alert("Error updating post. Please try again.");
      } finally {
        hideLoading(editPostForm);
      }
    });
  }

  // Handle delete button
  if (deletePostBtn) {
    deletePostBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
        try {
          showLoading(editPostForm);
          await deleteDoc(doc(db, "posts", currentPostId));
          alert("Post deleted successfully!");
          window.location.href = "index.html";
        } catch (error) {
          console.error("Error deleting post:", error);
          alert("Error deleting post. Please try again.");
        } finally {
          hideLoading(editPostForm);
        }
      }
    });
  }

  // Handle authentication state
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");

  if (loginLink && logoutBtn) {
    onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed. Current user:", user ? user.uid : "No user");

      if (user) {
        loginLink.style.display = "none";
        logoutBtn.style.display = "block";
        // Only load post data if we have a post ID
        if (currentPostId) {
          loadPostData();
        } else {
          console.error("No post ID provided in URL");
          alert("No post ID provided. Redirecting to home page...");
          window.location.href = "index.html";
        }
      } else {
        loginLink.style.display = "block";
        logoutBtn.style.display = "none";
        window.location.href = "login.html";
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

  // Initialize
  setupTextFormatting();
  setupImageEditing();
  updateCharacterCount();
}); 
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

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing event listeners...");

  // Initialize SunEditor instances
  let editor, titleEditor;
  initializeSunEditors();

  // Initialize elements
  const postForm = document.getElementById("postForm");
  const imageInput = document.getElementById("image");
  const insertImageBtn = document.getElementById("insertImageBtn");
  const imageUploadInput = document.getElementById("imageUpload");
  const previewContent = document.getElementById("previewContent");
  const previewTitle = document.querySelector('.preview-title');
  const previewBody = document.querySelector('.preview-body');
  const previewDate = document.querySelector('.preview-date');
  const previewFeaturedImage = document.querySelector('.preview-featured-image-container');
  const imageField = document.getElementById('image');
  const imageUpload = document.getElementById('imageUpload');
  const imagePreview = document.getElementById('imagePreview');
  const uploadBtn = document.getElementById('uploadBtn');
  const previewControls = document.querySelectorAll('.preview-control-btn');
  const preview = document.getElementById('preview');
  const autosaveStatus = document.getElementById('autosaveStatus');

  // Set current date in preview
  if (previewDate) {
    const now = new Date();
    previewDate.textContent = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  // Initialize event listeners
  initializeEventListeners();
  loadAutosavedData();

  function initializeSunEditors() {
    // Initialize SunEditor for content if the element exists
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
      });
    }

    // Initialize SunEditor for title if the element exists
    if (document.getElementById('title')) {
      titleEditor = SUNEDITOR.create('title', {
        buttonList: [
          ['undo', 'redo'],
          ['font', 'fontSize'],
          ['bold', 'underline', 'italic'],
          ['fontColor', 'hiliteColor'],
          ['align'],
        ],
        formats: ['p', 'h1', 'h2', 'h3'],
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
        fontSize: [16, 18, 20, 22, 24, 26, 28, 36, 48, 72],
        height: '100px',
        width: '100%',
        defaultStyle: 'font-size: 24px; font-weight: bold;',
        placeholder: 'Enter title here...',
      });
    }
  }

  function initializeEventListeners() {
    // Update preview when content editor changes
    if (editor && previewBody) {
      editor.onChange = function() {
        previewBody.innerHTML = editor.getContents();
        autosave();
      };
    }

    // Update preview when title editor changes
    if (titleEditor && previewTitle) {
      titleEditor.onChange = function() {
        previewTitle.innerHTML = titleEditor.getContents();
        autosave();
      };
    }

    // Handle image preview
    if (imageField) {
      imageField.addEventListener('input', updateImagePreview);
    }
    
    if (imageUpload && uploadBtn) {
      imageUpload.addEventListener('change', handleImageUpload);
      uploadBtn.addEventListener('click', function() {
        imageUpload.click();
      });
    }

    // Handle preview device switching
    if (previewControls && previewControls.length > 0) {
      previewControls.forEach(control => {
        control.addEventListener('click', function() {
          previewControls.forEach(c => c.classList.remove('active'));
          this.classList.add('active');
          
          const view = this.dataset.view;
          preview.className = `preview-content preview-${view}`;
        });
      });
    }

    // Handle form submission
    if (postForm) {
      postForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (titleEditor && editor && imageField) {
          console.log('Title:', titleEditor.getContents());
          console.log('Content:', editor.getContents());
          console.log('Image URL:', imageField.value);
          // Implement actual form submission to your backend here
        }
      });
    }

    // Handle logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
          console.log("User signed out.");
          window.location.href = "index.html";
        });
      });
    }
  }

  function updateImagePreview() {
    if (!imageField || !previewFeaturedImage || !imagePreview) return;
    
    const imageUrl = imageField.value;
    if (imageUrl) {
      previewFeaturedImage.innerHTML = `<img src="${imageUrl}" class="preview-featured-image">`;
      imagePreview.innerHTML = `<img src="${imageUrl}">`;
    } else {
      previewFeaturedImage.innerHTML = '';
      imagePreview.innerHTML = '';
    }
    autosave();
  }

  function handleImageUpload(e) {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const imageUrl = event.target.result;
        if (imageField) {
          imageField.value = imageUrl;
          updateImagePreview();
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Autosave functionality
  let autosaveTimeout;

  function autosave() {
    if (!titleEditor || !editor || !imageField || !autosaveStatus) return;
    
    clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(() => {
      // Show autosave status
      autosaveStatus.classList.add('show');
      
      // Store data in localStorage
      const postData = {
        title: titleEditor.getContents(),
        content: editor.getContents(),
        image: imageField.value,
        lastSaved: new Date().toISOString()
      };
      
      localStorage.setItem('autosave_post', JSON.stringify(postData));
      
      // Hide autosave status after 2 seconds
      setTimeout(() => {
        autosaveStatus.classList.remove('show');
      }, 2000);
    }, 1000);
  }

  // Load autosaved data if it exists
  function loadAutosavedData() {
    if (!titleEditor || !editor || !imageField) return;
    
    const savedData = localStorage.getItem('autosave_post');
    if (savedData) {
      const postData = JSON.parse(savedData);
      
      if (postData.title && titleEditor && previewTitle) {
        titleEditor.setContents(postData.title);
        previewTitle.innerHTML = postData.title;
      }
      
      if (postData.content && editor && previewBody) {
        editor.setContents(postData.content);
        previewBody.innerHTML = postData.content;
      }
      
      if (postData.image && imageField) {
        imageField.value = postData.image;
        updateImagePreview();
      }
    }
  }

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

  // Rest of your existing code...

  // Add character count
  function updateCharacterCount() {
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
  function updatePreview() {
    if (preview && contentEditor) {
      preview.innerHTML = contentEditor.innerHTML || "Post content preview will appear here...";
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
      const parsedDraft = JSON.parse(draft);
      document.getElementById("title").value = parsedDraft.title;
      contentEditor.innerHTML = parsedDraft.content;
      document.getElementById("tags").value = parsedDraft.tags;
      document.querySelector(`input[name="status"][value="${parsedDraft.status}"]`).checked = true;
      document.getElementById("postDate").value = parsedDraft.date;
      
      updatePreview();
      updateCharacterCount();
    }
  }

  // Initialize
  setupTextFormatting();
  setupImageEditing();
  loadDraft();
  updateCharacterCount();

  // Handle form submission
  if (postForm) {
    postForm.addEventListener("submit", async function(event) {
      event.preventDefault();

      const user = auth.currentUser;
      if (!user) {
        alert('Please log in to create a post');
        return;
      }

      const title = document.getElementById("title").value;
      const content = contentEditor.innerHTML;
      const tags = document.getElementById("tags").value;
      const status = document.querySelector('input[name="status"]:checked').value;
      const imageFile = imageInput ? imageInput.files[0] : null;
      let imageUrl = "";

      console.log("Creating post:", { title, content, tags, status });

      if (imageFile) {
        const imageRef = ref(storage, `images/${Date.now()}_${imageFile.name}`);
        try {
          showLoading(postForm);
          const uploadTask = uploadBytesResumable(imageRef, imageFile);
          
          // Wait for upload to complete
          await new Promise((resolve, reject) => {
            uploadTask.on('state_changed',
              (snapshot) => {
                // Update progress
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload progress:', progress + '%');
              },
              (error) => {
                console.error("Error uploading image:", error);
                reject(error);
              },
              async () => {
                try {
                  imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
                  console.log("Image uploaded:", imageUrl);
                  resolve();
                } catch (error) {
                  reject(error);
                }
              }
            );
          });
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          alert("Error uploading image. Please try again.");
          hideLoading(postForm);
          return;
        }
      }

      try {
        await addDoc(collection(db, "posts"), {
          title,
          content,
          tags,
          status,
          imageUrl,
          userId: user.uid,
          createdAt: serverTimestamp()
        });

        alert(`Post created successfully: ${title}`);
        postForm.reset();
        contentEditor.innerHTML = "";
        localStorage.removeItem('postDraft');
        if (preview) {
          preview.innerHTML = "Post content preview will appear here...";
        }
        updateCharacterCount();
        
        // Reload posts list after creating a new post
        loadUserPosts();
      } catch (error) {
        console.error("Error adding post:", error);
        alert("Error submitting post. Please try again.");
      } finally {
        hideLoading(postForm);
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

uploadBtn.addEventListener('click', () => imageUpload.click());

imageUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    imageUrlInput.value = url;
    imagePreview.innerHTML = `<img src="${url}" alt="Preview">`;
  } catch (error) {
    console.error('Error uploading image:', error);
    alert('Error uploading image. Please try again.');
  }
});

// Update image preview when URL is entered
imageUrlInput.addEventListener('input', (e) => {
  const url = e.target.value;
  if (url) {
    imagePreview.innerHTML = `<img src="${url}" alt="Preview">`;
  } else {
    imagePreview.innerHTML = '';
  }
});

// Initialize SunEditor with image upload handler
const editor = SUNEDITOR.create('content', {
  buttonList: [
    ['undo', 'redo'],
    ['font', 'fontSize', 'formatBlock'],
    ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
    ['removeFormat', 'blockquote', 'codeView'],
    ['fontColor', 'hiliteColor'],
    ['indent', 'outdent'],
    ['align', 'horizontalRule', 'list', 'table'],
    ['link', 'image', 'video', 'fullScreen'],
  ],
  height: '600px',
  width: '100%',
  minHeight: '400px',
  maxHeight: '800px',
  callbacks: {
    onChange: function(contents) {
      updatePreview(contents);
    },
    onImageUpload: async function(files, info, uploadHandler) {
      try {
        const file = files[0];
        const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploadHandler(url);
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Error uploading image. Please try again.');
      }
    }
  }
});

// Preview mode handling
const previewControls = document.querySelectorAll('.preview-control-btn');
const preview = document.getElementById('preview');

previewControls.forEach(btn => {
  btn.addEventListener('click', () => {
    previewControls.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    preview.className = 'preview-content';
    preview.classList.add(`preview-${btn.dataset.view}`);
  });
});

// Enhanced preview update function
function updatePreview(contents) {
  const title = document.getElementById('title').value;
  const imageUrl = document.getElementById('image').value;
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Update featured image
  const imageContainer = preview.querySelector('.preview-featured-image-container');
  if (imageUrl) {
    imageContainer.innerHTML = `<img src="${imageUrl}" alt="${title}" class="preview-featured-image">`;
  } else {
    imageContainer.innerHTML = '';
  }

  // Update title
  preview.querySelector('.preview-title').textContent = title;

  // Update date
  preview.querySelector('.preview-date').textContent = date;

  // Update content
  preview.querySelector('.preview-body').innerHTML = contents;
}

// Update preview when title changes
document.getElementById('title').addEventListener('input', () => {
  updatePreview(editor.getContents());
});

// Update preview when image changes
imageUrlInput.addEventListener('input', () => {
  updatePreview(editor.getContents());
});

// Initialize preview with empty content
updatePreview('');

// Autosave functionality
let autosaveTimeout;
const autosaveStatus = document.getElementById('autosaveStatus');
const AUTOSAVE_DELAY = 2000; // 2 seconds

function showAutosaveStatus() {
  autosaveStatus.classList.add('show');
}

function hideAutosaveStatus() {
  autosaveStatus.classList.remove('show');
}

async function autosave() {
  const title = document.getElementById('title').value;
  const content = editor.getContents();
  const imageUrl = document.getElementById('image').value;

  if (!title && !content) return;

  try {
    const draft = {
      title,
      content,
      imageUrl,
      lastSaved: new Date(),
    };
    localStorage.setItem('postDraft', JSON.stringify(draft));
    hideAutosaveStatus();
  } catch (error) {
    console.error('Error autosaving:', error);
  }
}

// Load draft if exists
const savedDraft = localStorage.getItem('postDraft');
if (savedDraft) {
  const draft = JSON.parse(savedDraft);
  document.getElementById('title').value = draft.title || '';
  editor.setContents(draft.content || '');
  document.getElementById('image').value = draft.imageUrl || '';
  if (draft.imageUrl) {
    document.getElementById('imagePreview').innerHTML = `<img src="${draft.imageUrl}" alt="Preview">`;
  }
}

// Setup autosave listeners
document.getElementById('title').addEventListener('input', () => {
  clearTimeout(autosaveTimeout);
  showAutosaveStatus();
  autosaveTimeout = setTimeout(autosave, AUTOSAVE_DELAY);
});

editor.onChange = function(contents) {
  updatePreview(contents);
  clearTimeout(autosaveTimeout);
  showAutosaveStatus();
  autosaveTimeout = setTimeout(autosave, AUTOSAVE_DELAY);
};

// Handle form submission
document.getElementById('postForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('title').value;
  const content = editor.getContents();
  const imageUrl = document.getElementById('image').value;

  try {
    await addDoc(collection(db, "posts"), {
      title,
      content,
      imageUrl,
      createdAt: new Date(),
    });

    localStorage.removeItem('postDraft'); // Clear draft after successful submission
    alert('Post published successfully!');
    window.location.href = 'admin-dashboard.html';
  } catch (error) {
    console.error('Error publishing post:', error);
    alert('Error publishing post. Please try again.');
  }
});

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
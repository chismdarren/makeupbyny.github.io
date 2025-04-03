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
  serverTimestamp,
  collection,
  query,
  orderBy,
  getDocs,
  where,
  limit
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

// Store posts data globally for sorting
let allPosts = [];
let editor = null; // SunEditor instance

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing event listeners...");

  // Initialize elements
  const editPostForm = document.getElementById("editPostForm");
  const contentElement = document.getElementById("content");
  const previewContent = document.getElementById("previewContent");
  const deletePostBtn = document.getElementById("deletePostBtn");
  const sortBySelect = document.getElementById("sortBy");
  const postsList = document.querySelector(".posts-list");
  const searchInput = document.getElementById("searchPosts");
  const titleField = document.getElementById("titleField");
  const titleHiddenInput = document.getElementById("title");
  const titleFontSelect = document.getElementById("titleFont");
  
  // Preview popup elements
  const previewBtn = document.getElementById('previewBtn');
  const closePreviewBtn = document.getElementById('closePreviewBtn');
  const previewSection = document.getElementById('previewSection');
  const previewOverlay = document.getElementById('previewOverlay');
  
  // Initialize SunEditor
  if (contentElement) {
    editor = SUNEDITOR.create(contentElement, {
      buttonList: [
        ['undo', 'redo'],
        ['font', 'fontSize', 'formatBlock'],
        ['bold', 'underline', 'italic', 'strike', 'subscript', 'superscript'],
        ['removeFormat'],
        ['fontColor', 'hiliteColor'],
        ['outdent', 'indent'],
        ['align', 'list', 'lineHeight'],
        ['table', 'link', 'image', 'video'],
        ['fullScreen', 'showBlocks', 'codeView'],
        ['preview', 'print']
      ],
      width: '100%',
      minHeight: '400px',
      placeholder: 'Start writing your content here...',
      imageUploadUrl: null, // We'll handle uploads manually
      imageUploadSizeLimit: 5 * 1024 * 1024, // 5MB
      videoResizing: true,
      videoHeightShow: true,
      videoRatioShow: true,
      videoWidth: '100%',
      youtubeQuery: 'autoplay=0&mute=0',
      tabDisable: false,
      callBackSave: function(contents) {
        console.log('SunEditor contents saved:', contents);
      },
      // Use the language pack if available, otherwise use null
      lang: typeof SUNEDITOR_LANG !== 'undefined' ? SUNEDITOR_LANG['en'] : null
    });

    // Handle SunEditor events
    editor.onChange = function(contents) {
      if (previewContent) {
        previewContent.innerHTML = contents;
      }
    };
  }

  // Handle title field and font
  if (titleField && titleHiddenInput) {
    // Handle input in the title field
    titleField.addEventListener('input', function() {
      // Create a temporary div to decode HTML entities
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.innerHTML;
      const decodedText = tempDiv.textContent || tempDiv.innerText || '';
      
      // Replace &nbsp; with regular spaces and trim
      const cleanTitle = decodedText.replace(/&nbsp;/g, ' ').trim();
      
      // Update hidden input for form submission with clean text
      titleHiddenInput.value = cleanTitle;
      
      // Update the preview title
      updateTitlePreview(this.innerHTML);
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
    titleFontSelect.addEventListener('change', function() {
      const selectedFont = this.value;
      titleField.style.fontFamily = selectedFont;
      
      // Update preview title font
      const previewTitle = document.getElementById('previewTitle');
      if (previewTitle) {
        previewTitle.style.fontFamily = selectedFont;
      }
    });
  }

  // Update title preview
  function updateTitlePreview(contents) {
    const previewTitle = document.getElementById('previewTitle');
    if (previewTitle) {
      previewTitle.innerHTML = contents || 'Post Title';
      
      // Apply the selected font to the preview title
      if (titleFontSelect) {
        previewTitle.style.fontFamily = titleFontSelect.value;
      }
    }
  }

  // Get post ID from URL
  const params = new URLSearchParams(window.location.search);
  const currentPostId = params.get("postId");
  
  // Variable to keep track of the latest post
  let latestPostId = null;
  
  // Handle sorting change
  if (sortBySelect) {
    sortBySelect.addEventListener('change', () => {
      sortAndRenderPosts(sortBySelect.value);
    });
  }

  // Handle search input
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const currentSortValue = sortBySelect ? sortBySelect.value : 'newest';
      sortAndRenderPosts(currentSortValue);
    });
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

  // Add character count
  function updateCharacterCount() {
    const content = contentElement.innerHTML;
    const charCount = content.replace(/<[^>]*>/g, '').length;
    const charCountElement = document.getElementById('charCount');
    if (charCountElement) {
      charCountElement.textContent = `Character count: ${charCount}`;
    }
  }

  // Update preview
  function updatePreview() {
    if (previewContent && contentElement) {
      previewContent.innerHTML = contentElement.innerHTML || "Post content preview will appear here...";
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
        contentElement.focus();
      });
    }
    
    if (italicBtn) {
      italicBtn.addEventListener('click', () => {
        document.execCommand('italic', false, null);
        contentElement.focus();
      });
    }
    
    if (underlineBtn) {
      underlineBtn.addEventListener('click', () => {
        document.execCommand('underline', false, null);
        contentElement.focus();
      });
    }
    
    // Font family
    if (fontFamilySelect) {
      fontFamilySelect.addEventListener('change', () => {
        document.execCommand('fontName', false, fontFamilySelect.value);
        contentElement.focus();
      });
    }
    
    // Font size
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', () => {
        document.execCommand('fontSize', false, fontSizeSelect.value);
        contentElement.focus();
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

      showLoading(contentElement);
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
      if (contentElement) {
        contentElement.innerHTML = tempImgHtml + contentElement.innerHTML;
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
                  if (contentElement) {
                    const tempElement = contentElement.querySelector(`#temp-${tempId}`);
                    if (tempElement) {
                      tempElement.outerHTML = finalImgHtml;
                    }
                  }
                  
                  hideLoading(contentElement);
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
        hideLoading(contentElement);
        hideLoading(previewContent);
        reject(new Error('Error reading file'));
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle image editing
  function setupImageEditing() {
    if (contentElement) {
      contentElement.addEventListener('click', function(e) {
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
  const insertImageBtn = document.getElementById("insertImageBtn");
  const imageUploadInput = document.getElementById("imageUpload");
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
  if (contentElement) {
    contentElement.addEventListener("input", function() {
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
  async function loadPostData(postId = currentPostId) {
    if (!postId) {
      console.error("No post ID provided");
      alert("No post ID provided. Please select a post from the sidebar.");
      return;
    }

    try {
      // Update the current post ID
      window.currentPostId = postId;
      
      showLoading(editPostForm);
      console.log("Loading post data for ID:", postId);
      
      const postDocRef = doc(db, "posts", postId);
      const postSnapshot = await getDoc(postDocRef);
      
      if (postSnapshot.exists()) {
        const postData = postSnapshot.data();
        console.log("Post data loaded:", postData);
        
        // Populate form fields
        const titleInput = document.getElementById("title");
        const titleField = document.getElementById("titleField");
        const titleFontSelect = document.getElementById("titleFont");
        const tagsInput = document.getElementById("tags");
        const dateInput = document.getElementById("postDate");
        const statusInputs = document.querySelectorAll('input[name="status"]');
        
        // Update title field and font
        if (titleField) {
          titleField.innerHTML = postData.title || '';
          
          // Set title font if specified
          if (postData.titleFont && titleFontSelect) {
            titleFontSelect.value = postData.titleFont;
            titleField.style.fontFamily = postData.titleFont;
          }
        }
        
        // Update hidden title input
        if (titleInput) {
          titleInput.value = postData.title || '';
        }
        
        // Update content in SunEditor
        if (editor) {
          editor.setContents(postData.content || '');
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
        
        if (previewTitle) {
          previewTitle.textContent = postData.title || "Post Title Preview";
          if (postData.titleFont) {
            previewTitle.style.fontFamily = postData.titleFont;
          }
        }
        
        if (previewContent) {
          previewContent.innerHTML = postData.content || "Post content preview will appear here...";
        }
        
        if (previewTags) previewTags.textContent = postData.tags ? `Tags: ${postData.tags}` : '';
        if (previewDate) {
          const date = postData.postDate || postData.lastModified || postData.createdAt;
          previewDate.textContent = date ? new Date(date).toLocaleDateString() : '';
        }
        
        // Highlight the active post in the sidebar
        document.querySelectorAll('.post-item').forEach(item => {
          item.classList.remove('active');
          if (item.dataset.postId === postId) {
            item.classList.add('active');
          }
        });
        
        console.log("Post data loaded successfully");
      } else {
        console.error("Post not found for ID:", postId);
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

      // Get title from the hidden input (already cleaned)
      const title = document.getElementById("title").value;
      
      // Get title font
      const titleFont = document.getElementById("titleFont").value;
      
      // Get content from SunEditor
      const content = editor ? editor.getContents() : '';
      
      const tags = document.getElementById("tags").value;
      const status = document.querySelector('input[name="status"]:checked').value;
      const postDate = document.getElementById("postDate").value;

      try {
        showLoading(editPostForm);
        await updateDoc(doc(db, "posts", window.currentPostId), {
          title,
          titleFont,
          content,
          tags,
          status,
          postDate,
          lastModified: serverTimestamp()
        });

        alert("Post updated successfully!");
        window.location.href = "admin-dashboard.html";
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
  const adminDashboardLink = document.getElementById("adminDashboard");

  if (loginLink && logoutBtn) {
    onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed. Current user:", user ? user.uid : "No user");

      if (user) {
        loginLink.style.display = "none";
        logoutBtn.style.display = "block";
        
        // Show admin dashboard link only for admin user
        if (user.uid === adminUID && adminDashboardLink) {
          adminDashboardLink.style.display = "inline";
        }
        
        // Load all posts for the sidebar
        loadAllPosts().then(() => {
          // If no specific post ID was provided, load the most recent post
          if (!currentPostId && latestPostId) {
            // Update the URL with the latest post ID without refreshing
            const url = new URL(window.location);
            url.searchParams.set('postId', latestPostId);
            window.history.pushState({}, '', url);
            
            // Load the latest post
            loadPostData(latestPostId);
          } else if (currentPostId) {
            // Load the specified post
            loadPostData(currentPostId);
          } else {
            console.error("No posts found");
          }
        });
      } else {
        loginLink.style.display = "block";
        logoutBtn.style.display = "none";
        if (adminDashboardLink) {
          adminDashboardLink.style.display = "none";
        }
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

  // Function to load all posts for the sidebar
  async function loadAllPosts() {
    try {
      const postsRef = collection(db, "posts");
      const q = query(postsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        if (postsList) {
          postsList.innerHTML = '<div class="no-posts">No posts found</div>';
        }
        return;
      }
      
      // Store posts for sorting
      allPosts = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || 'Untitled Post',
          createdAt: data.createdAt?.toDate() || new Date(),
          commentCount: 0 // Will be populated if needed
        };
      });
      
      // Store the ID of the most recent post
      if (allPosts.length > 0) {
        latestPostId = allPosts[0].id;
      }
      
      // Load comment counts for each post
      await loadCommentCounts();
      
      // Initial sort by newest (default)
      sortAndRenderPosts('newest');
      
    } catch (error) {
      console.error("Error loading posts:", error);
      if (postsList) {
        postsList.innerHTML = '<div class="error">Error loading posts</div>';
      }
    }
  }
  
  // Function to load comment counts for all posts
  async function loadCommentCounts() {
    try {
      for (let post of allPosts) {
        // For each post, get the comments collection
        const commentsRef = collection(db, "posts", post.id, "comments");
        const q = query(commentsRef);
        const querySnapshot = await getDocs(q);
        
        // Store the comment count
        post.commentCount = querySnapshot.size;
      }
    } catch (error) {
      console.error("Error loading comment counts:", error);
    }
  }
  
  // Function to sort and render posts in the sidebar
  function sortAndRenderPosts(sortType) {
    if (!postsList) return;
    
    let sortedPosts = [...allPosts];
    
    // Filter posts by search term if search input exists and has value
    if (searchInput && searchInput.value.trim() !== '') {
      const searchTerm = searchInput.value.trim().toLowerCase();
      sortedPosts = sortedPosts.filter(post => 
        post.title.toLowerCase().includes(searchTerm)
      );
    }
    
    switch (sortType) {
      case 'newest':
        sortedPosts.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        sortedPosts.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'title':
        sortedPosts.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'comments':
        sortedPosts.sort((a, b) => b.commentCount - a.commentCount);
        break;
    }
    
    // Clear the posts list
    postsList.innerHTML = '';
    
    // Show message if no posts match search
    if (sortedPosts.length === 0) {
      postsList.innerHTML = '<div class="no-posts">No posts found</div>';
      return;
    }
    
    // Add each post to the list
    sortedPosts.forEach(post => {
      const postElement = document.createElement('div');
      postElement.className = 'post-item';
      postElement.dataset.postId = post.id;
      
      // Mark as active if this is the current post
      if (post.id === (currentPostId || latestPostId)) {
        postElement.classList.add('active');
      }
      
      // Format date
      const date = post.createdAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      postElement.innerHTML = `
        <div class="post-item-title">${post.title}</div>
        <div class="post-item-meta">
          <span>${date}</span>
          <span>${post.commentCount} comments</span>
        </div>
        <div class="post-item-actions">
          <button class="post-action-btn archive-post-btn" title="Archive Post">Archive</button>
          <button class="post-action-btn delete-post-btn" title="Delete Post">Delete</button>
        </div>
      `;
      
      // Add click event to load the post
      postElement.querySelector('.post-item-title').addEventListener('click', () => {
        // Change URL without page refresh
        const url = new URL(window.location);
        url.searchParams.set('postId', post.id);
        window.history.pushState({}, '', url);
        
        // Load the selected post
        loadPostData(post.id);
        
        // Update active state in sidebar
        document.querySelectorAll('.post-item').forEach(item => {
          item.classList.remove('active');
        });
        postElement.classList.add('active');
      });
      
      // Add click event for the meta info to also load the post
      postElement.querySelector('.post-item-meta').addEventListener('click', () => {
        postElement.querySelector('.post-item-title').click();
      });
      
      // Add delete button handler
      const deleteBtn = postElement.querySelector('.delete-post-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent post selection
          
          if (confirm(`Are you sure you want to delete "${post.title}"? This action cannot be undone.`)) {
            try {
              await deleteDoc(doc(db, "posts", post.id));
              
              // Remove from DOM
              postElement.remove();
              
              // Remove from allPosts array
              const index = allPosts.findIndex(p => p.id === post.id);
              if (index >= 0) {
                allPosts.splice(index, 1);
              }
              
              // Notify user
              alert("Post deleted successfully!");
              
              // If deleted post is currently loaded, redirect to latest post
              if (post.id === currentPostId) {
                if (allPosts.length > 0) {
                  // Load another post
                  const nextPostId = allPosts[0].id;
                  
                  // Update URL
                  const url = new URL(window.location);
                  url.searchParams.set('postId', nextPostId);
                  window.history.pushState({}, '', url);
                  
                  // Load the post
                  loadPostData(nextPostId);
                } else {
                  // No posts left, redirect to dashboard
                  window.location.href = "admin-dashboard.html";
                }
              }
            } catch (error) {
              console.error("Error deleting post:", error);
              alert("Error deleting post. Please try again.");
            }
          }
        });
      }
      
      // Add archive button handler
      const archiveBtn = postElement.querySelector('.archive-post-btn');
      if (archiveBtn) {
        archiveBtn.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent post selection
          
          try {
            // Update post to archived status
            await updateDoc(doc(db, "posts", post.id), {
              status: 'archived',
              lastModified: serverTimestamp()
            });
            
            // Update visual indication
            archiveBtn.textContent = "Archived";
            archiveBtn.disabled = true;
            
            // Notify user
            alert(`"${post.title}" has been archived.`);
            
            // If this is the current post, reload it to show updated status
            if (post.id === currentPostId) {
              loadPostData(post.id);
            }
          } catch (error) {
            console.error("Error archiving post:", error);
            alert("Error archiving post. Please try again.");
          }
        });
      }
      
      postsList.appendChild(postElement);
    });
  }

  // Preview popup functionality
  if (previewBtn && previewSection) {
    // Open preview
    previewBtn.addEventListener('click', function() {
      previewSection.classList.add('open');
      previewOverlay.classList.add('open');
      document.body.style.overflow = 'hidden'; // Prevent scrolling behind modal
    });
    
    // Close preview when clicking the close button
    if (closePreviewBtn) {
      closePreviewBtn.addEventListener('click', function() {
        closePreview();
      });
    }
    
    // Close preview when clicking the overlay
    if (previewOverlay) {
      previewOverlay.addEventListener('click', function() {
        closePreview();
      });
    }
    
    // Close preview with escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && previewSection.classList.contains('open')) {
        closePreview();
      }
    });
  }
  
  // Close preview function
  function closePreview() {
    if (previewSection && previewOverlay) {
      previewSection.classList.remove('open');
      previewOverlay.classList.remove('open');
      document.body.style.overflow = ''; // Restore scrolling
    }
  }

  // Initialize
  setupTextFormatting();
  setupImageEditing();
  updateCharacterCount();
}); 

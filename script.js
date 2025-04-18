// Import Firebase Authentication functions and auth from firebase-config.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth, isAdminUser } from "./firebase-config.js";

// Import Firestore functions including query and document update/delete functions
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
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js"; // ✅ Fixed URL

// Import Firebase Storage functions for image uploads
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Initialize Firestore and Storage
const db = getFirestore();
const storage = getStorage();

// Constants for profile icons
const PROFILE_ICONS = [
  { id: 'icon-1', color: '#FF5733', name: 'Red' },
  { id: 'icon-2', color: '#33FF57', name: 'Green' },
  { id: 'icon-3', color: '#3357FF', name: 'Blue' },
  { id: 'icon-4', color: '#F3FF33', name: 'Yellow' },
  { id: 'icon-5', color: '#33FFF3', name: 'Cyan' },
  { id: 'icon-6', color: '#F333FF', name: 'Magenta' },
  { id: 'icon-7', color: '#FF33A8', name: 'Pink' },
  { id: 'icon-8', color: '#A833FF', name: 'Purple' },
  { id: 'icon-9', color: '#33A8FF', name: 'Sky Blue' },
  { id: 'icon-10', color: '#FF8C33', name: 'Orange' }
];

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing event listeners...");

  // ===== Authentication State Handling =====
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const createPostLink = document.getElementById("createPost");
  const adminDropdownBtn = document.getElementById("adminDropdownBtn");

  if (loginLink && logoutBtn) {
    onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed. Current user:", user ? user.uid : "No user");

      if (user) {
        loginLink.style.display = "none";
        logoutBtn.style.display = "block";
        if (createPostLink) createPostLink.style.display = "inline";
        
        // Check if user is an admin
        const isAdmin = await isAdminUser(user.uid);
        console.log("User admin status:", isAdmin);
        
        // Show admin dropdown if user is an admin
        if (adminDropdownBtn) {
          adminDropdownBtn.style.display = isAdmin ? "inline" : "none";
        }
        
        // If we're on an admin page, load admin content
        if (isAdmin) {
          loadAdminContent();
        }
        
        // Check if we should show the profile icon popup
        const showProfileIconPopup = sessionStorage.getItem('showProfileIconPopup');
        if (showProfileIconPopup === 'true') {
          // Clear the flag so the popup doesn't show again
          sessionStorage.removeItem('showProfileIconPopup');
          
          // Show the profile icon selection popup
          showProfileIconSelectionPopup(user);
        }
      } else {
        loginLink.style.display = "block";
        logoutBtn.style.display = "none";
        if (createPostLink) createPostLink.style.display = "none";
        if (adminDropdownBtn) adminDropdownBtn.style.display = "none";
      }
    });
  }

  // Logout functionality
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
        console.log("User signed out.");
        window.location.href = "index.html";
      });
    });
  }

  // ===== Post Creation Handling (with Image Upload) =====
  const postForm = document.getElementById("postForm");
  const postsContainer = document.getElementById("postsContainer");

  if (postForm) {
    postForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      const title = document.getElementById("title").value;
      const content = document.getElementById("content").innerHTML;
      const tags = document.getElementById("tags").value;
      const status = document.querySelector('input[name="status"]:checked').value;
      const imageInput = document.getElementById("image");
      const imageFile = imageInput ? imageInput.files[0] : null;
      let imageUrl = "";

      console.log("Creating post:", { title, content, tags, status });

      if (imageFile) {
        const imageRef = ref(storage, `images/${Date.now()}_${imageFile.name}`);
        try {
          await uploadBytes(imageRef, imageFile);
          imageUrl = await getDownloadURL(imageRef);
          console.log("Image uploaded:", imageUrl);
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          alert("Error uploading image. Please try again.");
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
          createdAt: serverTimestamp()
        });

        alert(`Post created successfully: ${title}`);
        postForm.reset();
      } catch (error) {
        console.error("Error adding post:", error);
        alert("Error submitting post. Please try again.");
      }
    });
  }

  // ===== Manage Posts Section =====
  async function loadAdminContent() {
    const postsListContainer = document.getElementById("postsList");
    if (postsListContainer) {
      try {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        postsListContainer.innerHTML = ""; // Clear existing content

        querySnapshot.forEach((docSnapshot) => {
          const postData = docSnapshot.data();
          const postWrapper = document.createElement("div");
          postWrapper.classList.add("post-wrapper");

          let imageHtml = postData.imageUrl
            ? `<img src="${postData.imageUrl}" alt="${postData.title}" style="max-width:100%; height:auto;">`
            : "";

          postWrapper.innerHTML = `
            <div class="post-content">
              <h3>${postData.title}</h3>
              ${imageHtml}
              <p>${postData.content.substring(0, 100)}...</p>
            </div>
            <div class="post-actions">
              <button class="editBtn" data-id="${docSnapshot.id}">Edit</button>
              <button class="deleteBtn" data-id="${docSnapshot.id}">Delete</button>
              <button class="archiveBtn" data-id="${docSnapshot.id}">Archive</button>
            </div>
          `;

          postsListContainer.appendChild(postWrapper);
        });
      } catch (error) {
        console.error("Error fetching posts:", error);
        postsListContainer.innerHTML = "<p>Error loading posts.</p>";
      }
    }
  }

  // ===== Event Listeners for Post Actions =====
  const postsListContainer = document.getElementById("postsList");
  if (postsListContainer) {
    postsListContainer.addEventListener("click", async (e) => {
      const target = e.target;
      const postId = target.getAttribute("data-id");

      if (target.classList.contains("deleteBtn") && confirm("Are you sure you want to delete this post?")) {
        try {
          await deleteDoc(doc(db, "posts", postId));
          alert("Post deleted successfully!");
          target.closest(".post-wrapper").remove();
        } catch (error) {
          console.error("Error deleting post:", error);
          alert("Error deleting post.");
        }
      } else if (target.classList.contains("archiveBtn") && confirm("Are you sure you want to archive this post?")) {
        try {
          await updateDoc(doc(db, "posts", postId), { archived: true });
          alert("Post archived successfully!");
          target.closest(".post-wrapper").remove();
        } catch (error) {
          console.error("Error archiving post:", error);
          alert("Error archiving post.");
        }
      } else if (target.classList.contains("editBtn")) {
        window.location.href = `edit-post.html?postId=${postId}`;
      }
    });
  }

  // Live update for post title
  document.getElementById("title").addEventListener("input", function() {
    document.getElementById("previewTitle").textContent = this.value || "Post Title Preview";
  });

  // Live update for post content
  const contentEditor = document.getElementById("content");
  if (contentEditor) {
    contentEditor.addEventListener("input", function() {
      const previewContent = document.getElementById("previewContent");
      if (previewContent) {
        previewContent.innerHTML = this.innerHTML || "Post content preview will appear here...";
      }
    });
  }

  // Live update for image preview
  const imageInput = document.getElementById("image");
  
  if (imageInput) {
    imageInput.addEventListener("change", function(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const imageUrl = e.target.result;
          const imgHtml = `<img src="${imageUrl}" alt="Preview" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;">`;
          
          // Update the preview content with the image
          const previewContent = document.getElementById("previewContent");
          if (previewContent) {
            previewContent.innerHTML = imgHtml + previewContent.innerHTML;
          }
          
          // If we have a content editor, also insert the image there
          if (contentEditor) {
            contentEditor.innerHTML = imgHtml + contentEditor.innerHTML;
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Handle image upload button click
  const insertImageBtn = document.getElementById("insertImageBtn");
  const imageUploadInput = document.getElementById("imageUpload");
  
  if (insertImageBtn && imageUploadInput) {
    insertImageBtn.addEventListener("click", () => {
      imageUploadInput.click();
    });
    
    imageUploadInput.addEventListener("change", function(event) {
      const files = event.target.files;
      if (files) {
        Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = function(e) {
            const imageUrl = e.target.result;
            const imgHtml = `<img src="${imageUrl}" alt="Preview" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;">`;
            
            // Insert image into content editor
            if (contentEditor) {
              contentEditor.innerHTML = imgHtml + contentEditor.innerHTML;
            }
            
            // Update preview
            const previewContent = document.getElementById("previewContent");
            if (previewContent) {
              previewContent.innerHTML = imgHtml + previewContent.innerHTML;
            }
          };
          reader.readAsDataURL(file);
        });
      }
    });
  }

  // Function to show profile icon selection popup
  async function showProfileIconSelectionPopup(user) {
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.className = 'profile-icon-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '1000';
    
    // Create popup content
    const popup = document.createElement('div');
    popup.className = 'profile-icon-popup';
    popup.style.backgroundColor = 'white';
    popup.style.borderRadius = '8px';
    popup.style.padding = '25px';
    popup.style.width = '500px';
    popup.style.maxWidth = '90%';
    popup.style.maxHeight = '90%';
    popup.style.overflowY = 'auto';
    popup.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';
    
    // Popup content
    popup.innerHTML = `
      <h2 style="text-align: center; margin-bottom: 20px;">Choose Your Profile Icon</h2>
      <p style="text-align: center; margin-bottom: 20px;">Select a profile icon that will represent you across the site.</p>
      
      <div class="current-icon" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">
        <div id="currentProfileIcon" style="width: 80px; height: 80px; border-radius: 50%; background-color: #f0f0f0; border: 1px solid #ddd; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #666; margin-bottom: 8px; overflow: hidden;">
          <span id="profileIconInitial"></span>
        </div>
        <span>Current Selection</span>
      </div>
      
      <div id="profileIconsGrid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 25px;">
        <!-- Icons will be added dynamically -->
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 20px;">
        <button id="skipButton" style="padding: 10px 20px; background-color: #f5f5f5; color: #333; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">Skip</button>
        <button id="saveIconButton" style="padding: 10px 20px; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">Save Icon</button>
      </div>
    `;
    
    // Add popup to overlay
    overlay.appendChild(popup);
    
    // Add overlay to body
    document.body.appendChild(overlay);
    
    // Get user data to display initial
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const initial = userData.firstName ? userData.firstName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();
      
      // Set the initial
      const profileIconInitial = document.getElementById('profileIconInitial');
      if (profileIconInitial) {
        profileIconInitial.textContent = initial;
      }
      
      // Variable to track selected icon
      let selectedProfileIcon = userData.profileIcon || null;
      
      // Populate icons grid
      const profileIconsGrid = document.getElementById('profileIconsGrid');
      if (profileIconsGrid) {
        PROFILE_ICONS.forEach(icon => {
          const iconDiv = document.createElement('div');
          iconDiv.style.width = '50px';
          iconDiv.style.height = '50px';
          iconDiv.style.borderRadius = '50%';
          iconDiv.style.backgroundColor = icon.color;
          iconDiv.style.cursor = 'pointer';
          iconDiv.style.border = '2px solid transparent';
          iconDiv.style.transition = 'transform 0.2s, border-color 0.2s';
          iconDiv.title = icon.name;
          iconDiv.dataset.icon = icon.id;
          
          // Mark as selected if it matches user's current icon
          if (userData.profileIcon === icon.id) {
            iconDiv.style.borderColor = '#333';
            iconDiv.style.transform = 'scale(1.05)';
            
            // Update preview
            const currentProfileIcon = document.getElementById('currentProfileIcon');
            if (currentProfileIcon) {
              currentProfileIcon.innerHTML = '';
              currentProfileIcon.style.backgroundColor = icon.color;
            }
          }
          
          // Add click handler
          iconDiv.addEventListener('click', () => {
            // Update selected state for all icons
            document.querySelectorAll('#profileIconsGrid > div').forEach(option => {
              option.style.borderColor = 'transparent';
              option.style.transform = 'none';
            });
            
            // Update this icon as selected
            iconDiv.style.borderColor = '#333';
            iconDiv.style.transform = 'scale(1.05)';
            
            // Update preview
            const currentProfileIcon = document.getElementById('currentProfileIcon');
            if (currentProfileIcon) {
              currentProfileIcon.innerHTML = '';
              currentProfileIcon.style.backgroundColor = icon.color;
            }
            
            // Store selection
            selectedProfileIcon = icon.id;
          });
          
          profileIconsGrid.appendChild(iconDiv);
        });
      }
      
      // Handle skip button
      const skipButton = document.getElementById('skipButton');
      if (skipButton) {
        skipButton.addEventListener('click', () => {
          // Close the popup
          document.body.removeChild(overlay);
        });
      }
      
      // Handle save button
      const saveIconButton = document.getElementById('saveIconButton');
      if (saveIconButton) {
        saveIconButton.addEventListener('click', async () => {
          if (selectedProfileIcon) {
            try {
              // Save the selected icon to user's profile
              await updateDoc(doc(db, 'users', user.uid), {
                profileIcon: selectedProfileIcon,
                updatedAt: new Date().toISOString()
              });
              
              // Show success message
              alert('Profile icon saved successfully!');
              
              // Close the popup
              document.body.removeChild(overlay);
              
              // Refresh page to show updated icon in navigation
              window.location.reload();
            } catch (error) {
              console.error('Error saving profile icon:', error);
              alert('Error saving profile icon. Please try again.');
            }
          } else {
            // If no icon is selected, just close the popup
            document.body.removeChild(overlay);
          }
        });
      }
    } catch (error) {
      console.error('Error loading user data for icon popup:', error);
      // Remove the overlay if there was an error
      document.body.removeChild(overlay);
    }
  }
});

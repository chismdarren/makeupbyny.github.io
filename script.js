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
  doc
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
});

// Import Firebase Authentication functions and auth from firebase-config.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

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
  doc
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
  const postForm = document.getElementById("postForm");
  const contentEditor = document.getElementById("content");
  const imageInput = document.getElementById("image");
  const insertImageBtn = document.getElementById("insertImageBtn");
  const imageUploadInput = document.getElementById("imageUpload");
  const previewContent = document.getElementById("previewContent");

  // Handle image upload and preview
  function handleImageUpload(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const imageUrl = e.target.result;
        const imgHtml = `<img src="${imageUrl}" alt="Preview" style="max-width: 100%; height: auto; margin: 10px 0; border-radius: 4px;">`;
        
        // Update preview
        if (previewContent) {
          previewContent.innerHTML = imgHtml + previewContent.innerHTML;
        }
        
        // Update content editor
        if (contentEditor) {
          contentEditor.innerHTML = imgHtml + contentEditor.innerHTML;
        }
        
        resolve(imageUrl);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Handle main image input
  if (imageInput) {
    imageInput.addEventListener("change", async function(event) {
      const file = event.target.files[0];
      if (file) {
        try {
          await handleImageUpload(file);
        } catch (error) {
          console.error("Error handling image:", error);
          alert("Error processing image. Please try again.");
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
        for (let file of files) {
          try {
            await handleImageUpload(file);
          } catch (error) {
            console.error("Error handling image:", error);
            alert("Error processing image. Please try again.");
          }
        }
      }
    });
  }

  // Live update for content
  if (contentEditor) {
    contentEditor.addEventListener("input", function() {
      if (previewContent) {
        previewContent.innerHTML = this.innerHTML || "Post content preview will appear here...";
      }
    });
  }

  // Handle form submission
  if (postForm) {
    postForm.addEventListener("submit", async function(event) {
      event.preventDefault();

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
        contentEditor.innerHTML = "";
        if (previewContent) {
          previewContent.innerHTML = "Post content preview will appear here...";
        }
      } catch (error) {
        console.error("Error adding post:", error);
        alert("Error submitting post. Please try again.");
      }
    });
  }

  // Handle authentication state
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const createPostLink = document.getElementById("createPost");

  if (loginLink && logoutBtn && createPostLink) {
    onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed. Current user:", user ? user.uid : "No user");

      if (user) {
        loginLink.style.display = "none";
        logoutBtn.style.display = "block";
        createPostLink.style.display = "inline";
      } else {
        loginLink.style.display = "block";
        logoutBtn.style.display = "none";
        createPostLink.style.display = "none";
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
}); 
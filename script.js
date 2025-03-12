// Import Firebase Authentication functions and auth from firebase.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase.js";

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
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Hardcoded admin UID (update if needed)
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {

  // ===== Authentication State Handling =====
  // Get elements from the DOM. Notice the correction for the create post link:
  // It now correctly references "createPost" (matching your index.html) instead of "create-post-link"
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const createPostLink = document.getElementById("createPost"); // Updated element ID

  // Listen for changes in authentication state
  if (loginLink && logoutBtn && createPostLink) {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in: hide login link, show logout and create post link
        loginLink.style.display = "none";
        logoutBtn.style.display = "block";
        createPostLink.style.display = "inline";
      } else {
        // User is not logged in: show login link, hide logout and create post link
        loginLink.style.display = "block";
        logoutBtn.style.display = "none";
        createPostLink.style.display = "none";
      }
    });
  }

  // Logout functionality: sign out user and redirect to index.html
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
        window.location.href = "index.html";
      });
    });
  }

  // ===== Post Creation Handling (with Image Upload) =====
  // Retrieve the post creation form and optional posts container for immediate display
  const postForm = document.getElementById("postForm");
  const postsContainer = document.getElementById("postsContainer");

  // If the post form exists, add a submit event listener to handle new posts
  if (postForm) {
    postForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      // Retrieve form values for title, content, and tags
      const title = document.getElementById("title").value;
      const content = document.getElementById("content").value;
      const tags = document.getElementById("tags").value; // Optional
      const statusElems = document.getElementsByName("status");
      let status = "draft"; // Default status
      statusElems.forEach((elem) => {
        if (elem.checked) status = elem.value;
      });

      // Retrieve the image file (if any) from the input field
      const imageInput = document.getElementById("image");
      const imageFile = imageInput ? imageInput.files[0] : null;
      let imageUrl = "";

      console.log("Form submitted");
      console.log("Title:", title);
      console.log("Content:", content);

      // If an image is selected, upload it to Firebase Storage and get the download URL
      if (imageFile) {
        // Using template literals to create a unique path for the image
        const imageRef = ref(storage, `images/${Date.now()}_${imageFile.name}`);
        try {
          await uploadBytes(imageRef, imageFile);
          imageUrl = await getDownloadURL(imageRef);
          console.log("Image URL:", imageUrl);
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          alert("Error uploading image. Please try again.");
          return; // Stop submission if image upload fails
        }
      }

      // Save the post to Firestore including the image URL (if available)
      try {
        await addDoc(collection(db, "posts"), {
          title: title,
          content: content,
          tags: tags,
          status: status,
          imageUrl: imageUrl, // Will be empty if no image was uploaded
          createdAt: serverTimestamp()
        });
        alert(`Post submitted: ${title}`);
      } catch (error) {
        console.error("Error adding post:", error);
        alert("Error submitting post. Please try again.");
      }

      // Optionally, add the new post to the UI immediately
      if (postsContainer) {
        const postElement = document.createElement("div");
        postElement.innerHTML = `<h3>${title}</h3><p>${content}</p>`;
        postsContainer.appendChild(postElement);
      }
      
      postForm.reset();
    });
  }

  // ===== Manage Posts Section: Listing Posts with Edit, Delete, and Archive Buttons (Admin Only) =====
  // This section only runs for the admin user
  onAuthStateChanged(auth, async (user) => {
    if (user && user.uid === adminUID) {
      const postsListContainer = document.getElementById("postsList");
      if (postsListContainer) {
        try {
          const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
          const querySnapshot = await getDocs(q);
          querySnapshot.forEach((docSnapshot) => {
            const postData = docSnapshot.data();
            // Create a wrapper div for each post that includes content and action buttons
            const postWrapper = document.createElement("div");
            postWrapper.classList.add("post-wrapper");
            // Build image HTML if an image URL exists
            let imageHtml = "";
            if (postData.imageUrl) {
              imageHtml = `<img src="${postData.imageUrl}" alt="${postData.title} image" style="max-width:100%; height:auto;">`;
            }
            // Construct inner HTML for the post with Edit, Delete, and Archive buttons
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
          console.error("Error fetching posts for admin:", error);
          postsListContainer.innerHTML = "<p>Error loading posts.</p>";
        }
      }
    }
  });

  // ===== Delegate Event Listeners for Post Actions (Edit, Delete, Archive) =====
  // Listen for clicks on the posts list container and handle button actions accordingly
  const postsListContainer = document.getElementById("postsList");
  if (postsListContainer) {
    postsListContainer.addEventListener("click", async (e) => {
      const target = e.target;
      // Handle Delete Action
      if (target.classList.contains("deleteBtn")) {
        const postId = target.getAttribute("data-id");
        if (confirm("Are you sure you want to delete this post?")) {
          try {
            await deleteDoc(doc(db, "posts", postId));
            alert("Post deleted successfully!");
            // Remove the post element from the UI
            target.closest(".post-wrapper").remove();
          } catch (error) {
            console.error("Error deleting post:", error);
            alert("Error deleting post.");
          }
        }
      }
      // Handle Archive Action
      else if (target.classList.contains("archiveBtn")) {
        const postId = target.getAttribute("data-id");
        if (confirm("Are you sure you want to archive this post?")) {
          try {
            await updateDoc(doc(db, "posts", postId), { archived: true });
            alert("Post archived successfully!");
            // Optionally, remove the post element from the UI
            target.closest(".post-wrapper").remove();
          } catch (error) {
            console.error("Error archiving post:", error);
            alert("Error archiving post.");
          }
        }
      }
      // Handle Edit Action: Redirect to the edit-post page with the appropriate postId
      else if (target.classList.contains("editBtn")) {
        const postId = target.getAttribute("data-id");
        window.location.href = `edit-post.html?postId=${postId}`;
      }
    });
  }
});

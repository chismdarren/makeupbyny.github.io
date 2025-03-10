// Import Firebase Authentication functions and auth from firebase.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase.js";

// Import Firestore functions
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Initialize Firestore
const db = getFirestore();

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Authentication state handling
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const createPostLink = document.getElementById("create-post-link");

  if (loginLink && logoutBtn && createPostLink) {
    onAuthStateChanged(auth, (user) => {
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

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
        window.location.href = "index.html";
      });
    });
  }

  // Handle post form submission (for creating a new post)
  const postForm = document.getElementById("postForm");
  // Optional container for immediate post display (if used)
  const postsContainer = document.getElementById("postsContainer");

  if (postForm) {
    postForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      let title = document.getElementById("title").value;
      let content = document.getElementById("content").value;
      
      console.log("Form submitted");
      console.log("Title:", title);
      console.log("Content:", content);

      // Save the post to Firestore
      try {
        await addDoc(collection(db, "posts"), {
          title: title,
          content: content,
          createdAt: serverTimestamp()
        });
        alert(`Post submitted: ${title}`);
      } catch (error) {
        console.error("Error adding post:", error);
        alert("Error submitting post.");
      }

      // Optionally, append the new post element to the postsContainer if it exists
      if (postsContainer) {
        const postElement = document.createElement("div");
        postElement.innerHTML = `<h3>${title}</h3><p>${content}</p>`;
        postsContainer.appendChild(postElement);
      }
      
      // Clear the form fields after submission
      postForm.reset();
    });
  }

  // If a container with ID "postsList" exists, fetch and display posts with edit links
  const postsListContainer = document.getElementById("postsList");
  if (postsListContainer) {
    (async () => {
      try {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
          const postData = doc.data();
          const postElement = document.createElement("div");
          postElement.innerHTML = `
            <h3>${postData.title}</h3>
            <p>${postData.content.substring(0, 100)}...</p>
            <a href="edit-post.html?postId=${doc.id}">Edit Post</a>
            <hr>
          `;
          postsListContainer.appendChild(postElement);
        });
      } catch (error) {
        console.error("Error fetching posts for editor:", error);
        postsListContainer.innerHTML = "<p>Error loading posts.</p>";
      }
    })();
  }
});

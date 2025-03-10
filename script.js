// Import Firebase Authentication functions and auth from firebase.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth } from "./firebase.js";

// Import Firestore functions including query functions
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

// Hardcoded admin UID (update if needed)
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // ===== Authentication State Handling =====
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

  // ===== Post Creation Handling =====
  const postForm = document.getElementById("postForm");
  const postsContainer = document.getElementById("postsContainer"); // Optional immediate display container

  if (postForm) {
    postForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      let title = document.getElementById("title").value;
      let content = document.getElementById("content").value;
      
      console.log("Form submitted");
      console.log("Title:", title);
      console.log("Content:", content);

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

      if (postsContainer) {
        const postElement = document.createElement("div");
        postElement.innerHTML = `<h3>${title}</h3><p>${content}</p>`;
        postsContainer.appendChild(postElement);
      }
      
      postForm.reset();
    });
  }

  // ===== Editor Page: Listing Posts with Edit Links (Admin Only) =====
  // This section will only execute if the logged-in user is the admin.
  onAuthStateChanged(auth, async (user) => {
    if (user && user.uid === adminUID) {
      const postsListContainer = document.getElementById("postsList");
      if (postsListContainer) {
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
      }
    }
  });
});

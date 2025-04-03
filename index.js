// Import necessary Firebase modules
import { db } from "./firebase-config.js";  // Import Firestore database instance
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";  // Firestore functions
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";  // Auth state observer
import { auth } from "./firebase-config.js";  // Auth instance

// Define admin user ID for special privileges
const adminUID = "yuoaYY14sINHaqtNK5EAz4nl8cc2";

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Monitor user authentication state
  onAuthStateChanged(auth, (user) => {
    // If user is logged in
    if (user) {
      // Hide login button, show logout button
      document.getElementById("login-link").style.display = "none";
      document.getElementById("logout-btn").style.display = "inline";

      // Check if user is admin
      if (user.uid === adminUID) {
        // Show admin dropdown button
        document.getElementById("adminDropdownBtn").style.display = "inline";
      } else {
        // Hide admin dropdown button for regular users
        document.getElementById("adminDropdownBtn").style.display = "none";
      }
    } else {
      // If user is not logged in, show login button and hide admin features
      document.getElementById("login-link").style.display = "inline";
      document.getElementById("logout-btn").style.display = "none";
      document.getElementById("adminDropdownBtn").style.display = "none";
    }
  });

  // Handle logout button click
  document.getElementById("logout-btn").addEventListener("click", () => {
    auth.signOut().then(() => {
      window.location.href = "index.html";
    });
  });

  // Toggle dropdown menu on click
  document.getElementById("adminDropdownBtn").addEventListener("click", function(e) {
    e.preventDefault(); // Prevent default link behavior
    this.classList.toggle("active");
    document.getElementById("adminDropdownContent").classList.toggle("show-dropdown");
  });

  // Close dropdown when clicking outside
  window.addEventListener("click", function(e) {
    if (!e.target.matches('#adminDropdownBtn')) {
      const dropdown = document.getElementById("adminDropdownContent");
      const btn = document.getElementById("adminDropdownBtn");
      if (dropdown.classList.contains("show-dropdown")) {
        dropdown.classList.remove("show-dropdown");
        btn.classList.remove("active");
      }
    }
  });

  // Get container for blog posts
  const blogPostsContainer = document.getElementById("blogPosts");
  let allPosts = []; // Store all posts for sorting

  // Function to render posts based on current sort order
  const renderPosts = (posts) => {
    // Clear the container
    blogPostsContainer.innerHTML = '';

    // Display all posts in the main content area
    for (const post of posts) {
      // Get comment count for each post
      post.commentCount = post.commentCount || 0; // Use cached count if available

      // Create post image HTML if available
      const imageHtml = post.imageUrl 
        ? `<img src="${post.imageUrl}" alt="${post.title} image" style="max-width:100%; height:auto;">`
        : "";

      // Create content preview (strip HTML and limit to 200 characters)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = post.content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const contentPreview = textContent.length > 200 
        ? textContent.substring(0, 200) + '...' 
        : textContent;

      // Create and append post element
      const postElement = document.createElement("div");
      
      // Get date for display (use postDate if available, fallback to createdAt)
      const getPostDate = (post) => {
        if (post.postDate) {
          // If postDate exists, it could be a string or a timestamp
          return typeof post.postDate === 'string' 
            ? new Date(post.postDate) 
            : new Date(post.postDate);
        } else {
          // Fall back to createdAt, which is a Firestore timestamp
          return post.createdAt.toDate();
        }
      };
      
      const displayDate = getPostDate(post);

      postElement.innerHTML = `
        <a href="post.html?postId=${post.id}" style="text-decoration: none; color: inherit;">
          <h3 style="${post.titleFont ? `font-family: '${post.titleFont}', cursive` : ''}">${post.title}</h3>
          <div class="post-meta" style="color: #666; font-size: 0.9em; margin-bottom: 10px;">
            ${displayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} by Ny - ${post.commentCount} comment${post.commentCount !== 1 ? 's' : ''}
          </div>
          ${imageHtml}
          <p>${contentPreview}</p>
          <p style="text-align: right; color: #a07; font-weight: bold;">Read more &rarr;</p>
        </a>
        <hr>
      `;
      blogPostsContainer.appendChild(postElement);
    }
  };

  // Function to sort posts based on selected option
  const sortPosts = (sortOption) => {
    let sortedPosts = [...allPosts]; // Create a copy of the posts array
    
    // Helper function to get comparable date from a post
    const getPostDate = (post) => {
      if (post.postDate) {
        // If postDate exists, it could be a string or a timestamp
        return typeof post.postDate === 'string' 
          ? new Date(post.postDate) 
          : new Date(post.postDate);
      } else {
        // Fall back to createdAt, which is a Firestore timestamp
        return post.createdAt.toDate();
      }
    };
    
    switch(sortOption) {
      case 'newest':
        sortedPosts.sort((a, b) => {
          return getPostDate(b) - getPostDate(a); // Newest first
        });
        break;
      case 'oldest':
        sortedPosts.sort((a, b) => {
          return getPostDate(a) - getPostDate(b); // Oldest first
        });
        break;
      case 'comments':
        sortedPosts.sort((a, b) => b.commentCount - a.commentCount); // Most comments first
        break;
    }
    
    renderPosts(sortedPosts);
  };

  // Add event listener to sort dropdown
  document.getElementById('sortPosts').addEventListener('change', (e) => {
    sortPosts(e.target.value);
    
    // Update the visual indicator
    const indicator = document.getElementById('activeSortIndicator');
    indicator.style.display = 'inline';
    
    // Set the indicator text based on selected option
    switch(e.target.value) {
      case 'newest':
        indicator.textContent = 'Newest';
        break;
      case 'oldest':
        indicator.textContent = 'Oldest';
        break;
      case 'comments':
        indicator.textContent = 'Most Comments';
        break;
    }
  });
  
  // Async function to fetch and display posts
  (async () => {
    try {
      // Query posts collection, ordered by creation date (newest first)
      const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      // Store all posts in an array
      allPosts = [];
      querySnapshot.forEach((doc) => {
        allPosts.push({ id: doc.id, ...doc.data() });
      });

      // Populate the recent posts sidebar (first 5 posts)
      const recentPostsList = document.getElementById("recentPostsList");
      
      // Sort posts by date for recent posts display (newest first)
      const sortedForRecent = [...allPosts].sort((a, b) => {
        // Helper function to get comparable date from a post
        const getPostDate = (post) => {
          if (post.postDate) {
            // If postDate exists, it could be a string or a timestamp
            return typeof post.postDate === 'string' 
              ? new Date(post.postDate) 
              : new Date(post.postDate);
          } else {
            // Fall back to createdAt, which is a Firestore timestamp
            return post.createdAt.toDate();
          }
        };
        
        return getPostDate(b) - getPostDate(a); // Newest first
      });
      
      sortedForRecent.slice(0, 5).forEach(post => {
        const recentPostElement = document.createElement("a");
        recentPostElement.href = `post.html?postId=${post.id}`;
        recentPostElement.className = "recent-post-item";
        
        // Create thumbnail image or placeholder
        const imageHtml = post.imageUrl 
          ? `<img src="${post.imageUrl}" alt="${post.title}">`
          : `<div style="width: 60px; height: 60px; background-color: #f0f0f0; border-radius: 8px;"></div>`;
        
        // Get date for display
        const getPostDate = (post) => {
          if (post.postDate) {
            // If postDate exists, it could be a string or a timestamp
            return typeof post.postDate === 'string' 
              ? new Date(post.postDate) 
              : new Date(post.postDate);
          } else {
            // Fall back to createdAt, which is a Firestore timestamp
            return post.createdAt.toDate();
          }
        };
        
        const displayDate = getPostDate(post);
        
        // Set up recent post item HTML
        recentPostElement.innerHTML = `
          ${imageHtml}
          <div>
            <div class="post-title">${post.title}</div>
            <div style="font-size: 0.8em; color: #666;">
              ${displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        `;
        
        recentPostsList.appendChild(recentPostElement);
      });

      // Fetch comment counts for all posts
      for (const post of allPosts) {
        const commentsQuery = query(collection(db, `posts/${post.id}/comments`));
        const commentsSnapshot = await getDocs(commentsQuery);
        post.commentCount = commentsSnapshot.size;
      }

      // Initial sort by newest (default)
      sortPosts('newest');
      
      // Show initial sort indicator
      document.getElementById('activeSortIndicator').style.display = 'inline';
      
    } catch (error) {
      // Handle any errors during post loading
      console.error("Error fetching posts:", error);
      blogPostsContainer.innerHTML = "<p>Error loading posts.</p>";
    }
  })();
}); 
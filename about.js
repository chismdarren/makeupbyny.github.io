// Import Firebase Authentication functions and auth from firebase-config.js
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { auth, app } from "./firebase-config.js";

// Import Firestore functions
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Initialize Firestore
const db = getFirestore();

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Initializing event listeners...");

  // Handle authentication state
  const loginLink = document.getElementById("login-link");
  const logoutBtn = document.getElementById("logout-btn");
  const createPostLink = document.getElementById("create-post-link");
  const editAboutBtn = document.getElementById("edit-about-btn");
  const editServicesBtn = document.getElementById("edit-services-btn");

  if (loginLink && logoutBtn && createPostLink) {
    onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed. Current user:", user ? user.uid : "No user");

      if (user) {
        loginLink.style.display = "none";
        logoutBtn.style.display = "block";
        createPostLink.style.display = "inline";
        if (editAboutBtn) editAboutBtn.style.display = "block";
        if (editServicesBtn) editServicesBtn.style.display = "block";
      } else {
        loginLink.style.display = "block";
        logoutBtn.style.display = "none";
        createPostLink.style.display = "none";
        if (editAboutBtn) editAboutBtn.style.display = "none";
        if (editServicesBtn) editServicesBtn.style.display = "none";
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

  // Load recent posts
  loadRecentPosts();
  // Load about page content
  loadAboutContent();
});

// Function to load about page content
async function loadAboutContent() {
  try {
    const aboutDoc = await getDoc(doc(db, 'content', 'about'));
    if (aboutDoc.exists()) {
      const data = aboutDoc.data();
      updateAboutContent(data);
    }
  } catch (error) {
    console.error('Error loading about content:', error);
  }
}

// Function to update about content in the DOM
function updateAboutContent(data) {
  const aboutText = document.getElementById('about-text');
  const profileImage = document.getElementById('profile-image');
  const servicesGrid = document.getElementById('services-grid');

  if (aboutText && data.aboutText) {
    aboutText.innerHTML = data.aboutText;
  }

  if (profileImage && data.profileImage) {
    profileImage.src = data.profileImage;
    profileImage.alt = data.profileImageAlt || 'Makeup Artist Profile';
  }

  if (servicesGrid && data.services) {
    servicesGrid.innerHTML = data.services.map(service => `
      <div class="service-card">
        <h3>${service.title}</h3>
        <p>${service.description}</p>
      </div>
    `).join('');
  }
}

// Function to edit about content
async function editAbout() {
  const aboutText = document.getElementById('about-text');
  const profileImage = document.getElementById('profile-image');
  
  if (!aboutText || !profileImage) return;

  const newAboutText = prompt('Enter new about text (HTML allowed):', aboutText.innerHTML);
  if (newAboutText === null) return;

  const newProfileImage = prompt('Enter new profile image URL:', profileImage.src);
  if (newProfileImage === null) return;

  try {
    await updateDoc(doc(db, 'content', 'about'), {
      aboutText: newAboutText,
      profileImage: newProfileImage,
      profileImageAlt: 'Makeup Artist Profile',
      lastUpdated: new Date()
    });

    // Update the DOM
    aboutText.innerHTML = newAboutText;
    profileImage.src = newProfileImage;
    alert('About content updated successfully!');
  } catch (error) {
    console.error('Error updating about content:', error);
    alert('Error updating about content. Please try again.');
  }
}

// Function to edit services
async function editServices() {
  const servicesGrid = document.getElementById('services-grid');
  if (!servicesGrid) return;

  const services = Array.from(servicesGrid.children).map(card => ({
    title: card.querySelector('h3').textContent,
    description: card.querySelector('p').textContent
  }));

  const newServices = [];
  for (let i = 0; i < 4; i++) {
    const title = prompt(`Enter title for service ${i + 1}:`, services[i]?.title || '');
    if (title === null) return;

    const description = prompt(`Enter description for service ${i + 1}:`, services[i]?.description || '');
    if (description === null) return;

    newServices.push({ title, description });
  }

  try {
    await updateDoc(doc(db, 'content', 'about'), {
      services: newServices,
      lastUpdated: new Date()
    });

    // Update the DOM
    servicesGrid.innerHTML = newServices.map(service => `
      <div class="service-card">
        <h3>${service.title}</h3>
        <p>${service.description}</p>
      </div>
    `).join('');

    alert('Services updated successfully!');
  } catch (error) {
    console.error('Error updating services:', error);
    alert('Error updating services. Please try again.');
  }
}

// Function to load and display recent posts
async function loadRecentPosts() {
  try {
    console.log('Loading recent posts...');
    const recentPostsList = document.getElementById('recentPostsList');
    if (!recentPostsList) {
      console.error('Recent posts list element not found');
      return;
    }

    // Show loading state
    recentPostsList.innerHTML = '<p>Loading recent posts...</p>';

    // Get recent posts from Firestore
    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const querySnapshot = await getDocs(q);
    console.log('Query completed. Number of posts found:', querySnapshot.size);

    if (querySnapshot.empty) {
      console.log('No posts found');
      recentPostsList.innerHTML = '<p>No posts available.</p>';
      return;
    }

    // Clear existing posts
    recentPostsList.innerHTML = '';

    // Add each post to the list
    querySnapshot.forEach((doc) => {
      const post = { id: doc.id, ...doc.data() };
      const postElement = createRecentPostElement(post);
      recentPostsList.appendChild(postElement);
    });
  } catch (error) {
    console.error('Error loading recent posts:', error);
    const recentPostsList = document.getElementById('recentPostsList');
    if (recentPostsList) {
      recentPostsList.innerHTML = '<p>Error loading recent posts. Please try again later.</p>';
    }
  }
}

// Function to create a recent post element
function createRecentPostElement(post) {
  const div = document.createElement('div');
  div.className = 'recent-post';
  
  // Format date
  const postDate = post.createdAt ? new Date(post.createdAt.seconds * 1000) : new Date();
  const formattedDate = postDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create post content
  div.innerHTML = `
    <h3><a href="post.html?postId=${post.id}">${post.title || 'Untitled Post'}</a></h3>
    <div class="post-meta">
      <span>${formattedDate}</span>
      <span class="status-badge status-${post.status || 'draft'}">${post.status || 'Draft'}</span>
    </div>
  `;

  return div;
} 
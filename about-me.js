// Import Firebase functions
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { auth } from "./firebase-config.js";

const db = getFirestore();

// Function to load about me content
export async function loadAboutMe() {
  try {
    const aboutMeRef = doc(db, "settings", "aboutMe");
    const aboutMeDoc = await getDoc(aboutMeRef);
    
    if (aboutMeDoc.exists()) {
      const data = aboutMeDoc.data();
      
      // Update all about me sections on the page
      document.querySelectorAll('.about-me p').forEach((p, index) => {
        if (index === 0) {
          p.innerHTML = data.mainText || '';
        } else if (index === 1) {
          p.innerHTML = data.subText || '';
        }
      });
    } else {
      // If document doesn't exist, create it with default content
      const defaultContent = {
        mainText: "Hello and welcome to my Makeup and Beauty Blog! I'm Ny, an aspiring makeup artist who's absolutely head-over-heels for all things beauty.",
        subText: "Dive into honest product rundowns, foolproof tutorials, and the latest beauty buzz—like a monthly magazine come to life, but with my personal spin (and the occasional cameo from my family). Enjoy!"
      };
      await updateDoc(doc(db, "settings", "aboutMe"), defaultContent);
    }
  } catch (error) {
    console.error("Error loading about me content:", error);
  }
}

// Function to save about me content
export async function saveAboutMe(mainText, subText) {
  try {
    const aboutMeRef = doc(db, "settings", "aboutMe");
    await updateDoc(aboutMeRef, {
      mainText,
      subText,
      lastUpdated: new Date()
    });
    return true;
  } catch (error) {
    console.error("Error saving about me content:", error);
    return false;
  }
}

// Function to initialize edit mode listeners
export function initializeAboutMeEdit() {
  // Only add edit listeners if user is admin
  auth.onAuthStateChanged(async (user) => {
    if (user && user.email === "admin@makeupbyny.com") {
      const aboutMeParagraphs = document.querySelectorAll('.about-me p');
      
      aboutMeParagraphs.forEach((p) => {
        // Add editable class if not already present
        if (!p.classList.contains('editable')) {
          p.classList.add('editable');
        }
      });
    }
  });
}

// Initialize about me content when the module is loaded
document.addEventListener('DOMContentLoaded', () => {
  loadAboutMe();
  initializeAboutMeEdit();
}); 
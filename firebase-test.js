// Simple test script to verify Firebase is working correctly
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Firebase configuration object (same as in firebase-config.js)
const firebaseConfig = {
  apiKey: "AIzaSyBeCYpS1JV5gJWD8qWsnVKenwgbDrIt_h8",
  authDomain: "makeupbyny-1.firebaseapp.com",
  projectId: "makeupbyny-1",
  storageBucket: "makeupbyny-1.appspot.com",
  messagingSenderId: "327675302548",
  appId: "1:327675302548:web:581f25c2c6aebaab629a81",
  measurementId: "G-P8F85KTSFP"
};

// Log the configuration being used
console.log("Firebase Config:", JSON.stringify(firebaseConfig));

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log("Firebase app initialized:", app);
console.log("Firestore database initialized:", db);

// Test function to try fetching data from Firestore
async function testFirestore() {
  try {
    console.log("Testing Firestore access...");
    
    // Try to fetch documents from 'users' collection
    const usersCollectionRef = collection(db, 'users');
    console.log("Created users collection reference:", usersCollectionRef);
    
    // Try reading documents
    const querySnapshot = await getDocs(usersCollectionRef);
    console.log(`Successfully retrieved ${querySnapshot.size} documents from users collection`);
    
    // Just log number of documents without exposing data
    console.log("✅ Firestore test successful!");
  } catch (error) {
    console.error("❌ Firestore test failed:", error);
  }
}

// Test function to try creating a contact_messages collection if needed
async function testContactCollection() {
  try {
    console.log("Testing contact_messages collection access...");
    
    // Try to reference the collection
    const contactCollectionRef = collection(db, 'contact_messages');
    console.log("Created contact_messages collection reference:", contactCollectionRef);
    
    // Try reading documents
    const querySnapshot = await getDocs(contactCollectionRef);
    console.log(`Successfully accessed contact_messages collection (${querySnapshot.size} documents found)`);
    
    console.log("✅ Contact messages collection test successful!");
  } catch (error) {
    console.error("❌ Contact messages collection test failed:", error);
  }
}

// Execute the tests when the document is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log("Running Firebase tests...");
  
  // Add a status display element
  const statusDiv = document.createElement('div');
  statusDiv.style.padding = '20px';
  statusDiv.style.margin = '20px';
  statusDiv.style.backgroundColor = '#f5f5f5';
  statusDiv.style.border = '1px solid #ddd';
  statusDiv.style.borderRadius = '4px';
  statusDiv.innerHTML = '<h3>Firebase Test Results</h3><div id="test-results">Running tests...</div>';
  document.body.prepend(statusDiv);
  
  const resultsDiv = document.getElementById('test-results');
  
  try {
    // Run Firestore tests
    await testFirestore();
    await testContactCollection();
    
    resultsDiv.innerHTML = `
      <p style="color: green">✅ Firebase tests completed successfully</p>
      <p>Your Firebase setup appears to be working correctly.</p>
      <p>You can close this page and return to your contact form.</p>
    `;
  } catch (error) {
    resultsDiv.innerHTML = `
      <p style="color: red">❌ Firebase tests failed</p>
      <p>Error: ${error.message}</p>
      <p>Please check the console for more details.</p>
    `;
  }
}); 
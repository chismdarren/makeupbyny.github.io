const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Enable CORS with credentials support
const corsHandler = cors({
  origin: "https://chismdarren.github.io",
  methods: "GET, OPTIONS",
  allowedHeaders: "Content-Type",
  credentials: true, // ✅ Allow credentials
});

// Cloud Function to list all Firebase Authentication users
exports.listAllAuthUsers = functions.https.onRequest((req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Handle preflight request (OPTIONS request)
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
        res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.set("Access-Control-Allow-Credentials", "true");
        res.status(204).send(""); // ✅ Send empty response for preflight request
        return;
      }

      // Fetch up to 1000 users
      const listUsersResult = await admin.auth().listUsers(1000);

      // Format the response
      const users = listUsersResult.users.map((userRecord) => ({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || "",
        disabled: userRecord.disabled,
      }));

      // ✅ Set proper CORS headers on the response
      res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Allow-Credentials", "true");

      return res.status(200).json(users);
    } catch (error) {
      console.error("Error listing users:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Cloud Function to create or update a user profile in Firestore
exports.createUserProfile = functions.https.onRequest((req, res) => {
  // Updated CORS handler for POST method
  const profileCorsHandler = cors({
    origin: true, // Allow any origin for testing
    methods: "POST, OPTIONS",
    allowedHeaders: "Content-Type",
    credentials: true,
  });

  return profileCorsHandler(req, res, async () => {
    try {
      // Handle preflight request (OPTIONS request)
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        res.set("Access-Control-Allow-Credentials", "true");
        res.status(204).send("");
        return;
      }

      // Check if the request method is POST
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      // Validate request body
      const { uid, email, userData } = req.body;
      
      if (!uid || !email) {
        return res.status(400).json({ error: "Missing required fields (uid or email)" });
      }

      // Check if user is a super admin
      let isUserSuperAdmin = false;
      const superAdminUIDs = ["yuoaYY14sINHaqtNK5EAz4nl8cc2"]; // Hardcoded super admin UID
      
      if (superAdminUIDs.includes(uid)) {
        isUserSuperAdmin = true;
      }

      try {
        // First check if a document already exists for this user
        const userRef = admin.firestore().collection("users").doc(uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
          // Document exists, update only missing fields
          const existingData = userDoc.data();
          const updates = {};
          
          // Only update fields that don't already exist or are empty
          if (userData.firstName && (!existingData.firstName || existingData.firstName === '')) {
            updates.firstName = userData.firstName;
          }
          
          if (userData.lastName && (!existingData.lastName || existingData.lastName === '')) {
            updates.lastName = userData.lastName;
          }
          
          if (userData.username && (!existingData.username || existingData.username === '')) {
            updates.username = userData.username;
          }
          
          if (userData.phoneNumber && (!existingData.phoneNumber || existingData.phoneNumber === '')) {
            updates.phoneNumber = userData.phoneNumber;
          }
          
          if (userData.termsAccepted && !existingData.termsAccepted) {
            updates.termsAccepted = userData.termsAccepted;
            updates.termsAcceptedDate = userData.termsAcceptedDate || new Date().toISOString();
          }
          
          // Always ensure email is current
          if (email && (!existingData.email || existingData.email !== email)) {
            updates.email = email;
          }
          
          // Check for admin status changes
          if (isUserSuperAdmin !== existingData.isSuperAdmin) {
            updates.isSuperAdmin = isUserSuperAdmin;
            updates.isAdmin = isUserSuperAdmin || existingData.isAdmin;
          }
          
          // Only update if there are changes
          if (Object.keys(updates).length > 0) {
            await userRef.update(updates);
            console.log(`User document for ${email} updated with:`, updates);
          }
          
        } else {
          // Document doesn't exist, create a new one
          // Create a full user document
          const newUserData = {
            email: email,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            username: userData.username || '',
            phoneNumber: userData.phoneNumber || '',
            termsAccepted: userData.termsAccepted || false,
            termsAcceptedDate: userData.termsAcceptedDate || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            isAdmin: isUserSuperAdmin,
            isSuperAdmin: isUserSuperAdmin
          };
          
          await userRef.set(newUserData);
          console.log(`New user document created for ${email}`);
        }
        
        return res.status(200).json({ success: true, message: "User profile created/updated successfully" });
      } catch (firestoreError) {
        console.error("Error accessing Firestore:", firestoreError);
        return res.status(500).json({ error: "Error creating/updating user profile in Firestore" });
      }
    } catch (error) {
      console.error("Error in createUserProfile function:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

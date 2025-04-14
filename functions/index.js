const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Enable CORS with credentials support
const corsHandler = cors({
  origin: "https://chismdarren.github.io",
  methods: "GET, OPTIONS",
  allowedHeaders: "Content-Type, Accept",
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
        res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
        res.set("Access-Control-Allow-Credentials", "true");
        res.status(204).send(""); // ✅ Send empty response for preflight request
        return;
      }

      // Always set CORS headers for the actual request as well
      res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
      res.set("Access-Control-Allow-Credentials", "true");

      // Fetch up to 1000 users
      const listUsersResult = await admin.auth().listUsers(1000);

      // Format the response
      const users = listUsersResult.users.map((userRecord) => ({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || "",
        disabled: userRecord.disabled,
      }));

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
    origin: "https://chismdarren.github.io", // Specifically allow the GitHub Pages domain
    methods: "POST, OPTIONS",
    allowedHeaders: "Content-Type, Accept", 
    credentials: true,
  });

  return profileCorsHandler(req, res, async () => {
    try {
      // Handle preflight request (OPTIONS request)
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
        res.set("Access-Control-Allow-Credentials", "true");
        res.status(204).send("");
        return;
      }

      // Always set CORS headers for the actual request as well
      res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
      res.set("Access-Control-Allow-Credentials", "true");

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

// Cloud Function to delete a user from both Auth and Firestore
exports.deleteUser = functions.https.onRequest((req, res) => {
  // Set up CORS handler for DELETE, POST and OPTIONS methods
  const deleteCorsHandler = cors({
    origin: "https://chismdarren.github.io", // Specifically allow the GitHub Pages domain
    methods: "DELETE, POST, OPTIONS",
    allowedHeaders: "Content-Type, Accept",
    credentials: true,
  });

  return deleteCorsHandler(req, res, async () => {
    try {
      // Handle preflight request (OPTIONS request)
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
        res.set("Access-Control-Allow-Methods", "DELETE, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
        res.set("Access-Control-Allow-Credentials", "true");
        res.status(204).send("");
        return;
      }

      // Always set CORS headers for the actual request as well
      res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
      res.set("Access-Control-Allow-Methods", "DELETE, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
      res.set("Access-Control-Allow-Credentials", "true");

      // Check if the request method is DELETE or POST with _method=DELETE
      const isDeleteMethod = 
        req.method === "DELETE" || 
        (req.method === "POST" && req.body._method === "DELETE");
      
      if (!isDeleteMethod) {
        return res.status(405).json({ error: "Method not allowed" });
      }

      // Get user ID from request
      const uid = req.query.uid;
      
      if (!uid) {
        return res.status(400).json({ error: "Missing required parameter: uid" });
      }

      console.log(`Attempting to delete user with UID: ${uid}`);

      // First check if we're trying to delete a super admin
      try {
        const userRef = admin.firestore().collection("users").doc(uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists && userDoc.data().isSuperAdmin) {
          // Count how many super admins we have
          const superAdminsQuery = await admin.firestore()
            .collection("users")
            .where("isSuperAdmin", "==", true)
            .get();
          
          if (superAdminsQuery.size <= 1) {
            return res.status(403).json({ 
              error: "Cannot delete the last super admin. Promote another user to super admin first." 
            });
          }
        }
      } catch (checkError) {
        console.error("Error checking user super admin status:", checkError);
        // Continue with deletion even if check fails
      }

      // Delete user data from Firestore first
      try {
        // Delete user document from Firestore
        await admin.firestore().collection("users").doc(uid).delete();
        console.log(`User document deleted from Firestore: ${uid}`);
      } catch (firestoreError) {
        console.error("Error deleting user document from Firestore:", firestoreError);
        // Continue with auth deletion even if Firestore deletion fails
      }

      // Delete user from Firebase Authentication
      try {
        await admin.auth().deleteUser(uid);
        console.log(`User deleted from Firebase Auth: ${uid}`);
        
        return res.status(200).json({ 
          success: true, 
          message: "User deleted successfully from both Auth and Firestore" 
        });
      } catch (authError) {
        console.error("Error deleting user from Firebase Auth:", authError);
        
        if (authError.code === 'auth/user-not-found') {
          // If user wasn't found in Auth but we already deleted from Firestore, consider it a success
          return res.status(200).json({ 
            success: true, 
            message: "User deleted from Firestore. User not found in Auth." 
          });
        }
        
        return res.status(500).json({ 
          error: "Error deleting user from Firebase Auth", 
          details: authError.message 
        });
      }
    } catch (error) {
      console.error("Error in deleteUser function:", error);
      return res.status(500).json({ error: error.message });
    }
  });
});

// Cloud Function to generate a password reset link for admin use
exports.generatePasswordResetLink = functions.https.onRequest((req, res) => {
  // Set up CORS handler for GET and OPTIONS methods
  const passwordResetCorsHandler = cors({
    origin: "https://chismdarren.github.io", // Specifically allow the GitHub Pages domain
    methods: "GET, OPTIONS",
    allowedHeaders: "Content-Type, Accept",
    credentials: true,
  });

  return passwordResetCorsHandler(req, res, async () => {
    try {
      // Handle preflight request (OPTIONS request)
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
        res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
        res.set("Access-Control-Allow-Credentials", "true");
        res.status(204).send("");
        return;
      }

      // Always set CORS headers for the actual request as well
      res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
      res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Accept");
      res.set("Access-Control-Allow-Credentials", "true");
      
      // Check if the request method is GET
      if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      // Get user ID and admin ID from request
      const uid = req.query.uid;
      const adminId = req.query.adminId;
      const callback = req.query.callback; // For JSONP support
      
      if (!uid) {
        const errorResponse = { error: "Missing required parameter: uid" };
        return callback 
          ? res.status(400).send(`${callback}(${JSON.stringify(errorResponse)})`)
          : res.status(400).json(errorResponse);
      }

      // Verify the requester is a super admin
      try {
        // First check if admin is in the hardcoded super admin list
        const superAdminUIDs = ["yuoaYY14sINHaqtNK5EAz4nl8cc2"]; // Same as in other functions
        let isSuperAdmin = superAdminUIDs.includes(adminId);
        
        // If not found in hardcoded list, check Firestore
        if (!isSuperAdmin && adminId) {
          const adminRef = admin.firestore().collection("users").doc(adminId);
          const adminDoc = await adminRef.get();
          if (adminDoc.exists && adminDoc.data().isSuperAdmin === true) {
            isSuperAdmin = true;
          }
        }
        
        if (!isSuperAdmin) {
          const errorResponse = { error: "Unauthorized. Super Admin privileges required." };
          return callback 
            ? res.status(403).send(`${callback}(${JSON.stringify(errorResponse)})`)
            : res.status(403).json(errorResponse);
        }
      } catch (authError) {
        console.error("Error checking admin permissions:", authError);
        const errorResponse = { error: "Error verifying admin permissions" };
        return callback 
          ? res.status(500).send(`${callback}(${JSON.stringify(errorResponse)})`)
          : res.status(500).json(errorResponse);
      }
      
      // Get user email
      try {
        const userRecord = await admin.auth().getUser(uid);
        const email = userRecord.email;
        
        if (!email) {
          const errorResponse = { error: "User does not have an email address" };
          return callback 
            ? res.status(400).send(`${callback}(${JSON.stringify(errorResponse)})`)
            : res.status(400).json(errorResponse);
        }
        
        // Generate a password reset link
        const resetLink = await admin.auth().generatePasswordResetLink(email);
        
        const successResponse = {
          success: true,
          email: email,
          resetLink: resetLink
        };
        
        return callback 
          ? res.status(200).send(`${callback}(${JSON.stringify(successResponse)})`)
          : res.status(200).json(successResponse);
      } catch (error) {
        console.error("Error generating password reset link:", error);
        const errorResponse = {
          error: "Error generating password reset link",
          details: error.message
        };
        
        return callback 
          ? res.status(500).send(`${callback}(${JSON.stringify(errorResponse)})`)
          : res.status(500).json(errorResponse);
      }
    } catch (error) {
      console.error("Error in generatePasswordResetLink function:", error);
      const errorResponse = { error: error.message };
      
      const callback = req.query.callback;
      return callback 
        ? res.status(500).send(`${callback}(${JSON.stringify(errorResponse)})`)
        : res.status(500).json(errorResponse);
    }
  });
});

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Enable CORS (Replace YOUR_ALLOWED_ORIGIN with your actual domain)
const corsHandler = cors({ origin: "https://chismdarren.github.io" });

// Cloud Function to list all Firebase Authentication users with CORS enabled
exports.listAllAuthUsers = functions.https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    try {
      // Fetch up to 1000 users at a time
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

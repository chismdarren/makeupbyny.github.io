const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Cloud Function to list all Firebase Authentication users
exports.listAllAuthUsers = functions.https.onRequest(async (req, res) => {
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

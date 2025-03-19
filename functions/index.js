const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

// Cloud Function to list all Firebase Authentication users with CORS enabled
exports.listAllAuthUsers = functions.https.onRequest(async (req, res) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.set("Access-Control-Max-Age", "86400");
    res.status(204).send("");
    return;
  }

  // Set CORS headers for the actual request
  res.set("Access-Control-Allow-Origin", "https://chismdarren.github.io");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Credentials", "true");

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
    return res.status(500).json({error: error.message});
  }
});

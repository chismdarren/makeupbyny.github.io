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

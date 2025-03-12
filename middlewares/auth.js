import admin from "../firebaseAdmin.js";

export const verifyUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // If no Authorization header is provided, treat as an unauthenticated user
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.user = null; // Allow unauthenticated users to proceed
      return next();
    }

    const token = authHeader.split(" ")[1];

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = decodedToken.uid;

    next();
  } catch (error) {
    console.error("Firebase Auth Error:", error.message || error);
    req.user = null;
    next();
  }
};

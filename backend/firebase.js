const admin = require("firebase-admin");

const serviceAccount = require("./config/firebase-key.json");

console.log(serviceAccount);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

module.exports = db;
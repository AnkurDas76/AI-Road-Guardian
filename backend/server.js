const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { initDb } = require("./db/database");
const apiRoutes = require("./routes/api");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Mount Unified API Routes
app.use("/", apiRoutes);

// Start Server & Initialize Database
const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Unified Node.js Express Backend running on http://127.0.0.1:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database initialization failed. Starting server anyway:", err);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (DB initialization warning)`);
    });
  });
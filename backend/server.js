const express = require("express");
const cors = require("cors");
require("dotenv").config();

const db = require("./firebase");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Home Route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Backend running",
  });
});

// Save Alert Route
app.post("/alert", async (req, res) => {
  try {
    const { driver_id, latitude, longitude } = req.body;

    if (!driver_id || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "driver_id, latitude and longitude are required"
      });
    }

    await db.collection("alerts").add({
      driver_id,
      latitude,
      longitude,
      timestamp: new Date(),
      status: "ACTIVE"
    });

    res.json({
      success: true,
      message: "Alert stored successfully"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
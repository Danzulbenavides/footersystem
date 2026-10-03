const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

// =====================================================
// DATABASE TEST
// =====================================================

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");

    res.json({
      message: "Database connection successful",
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error("Database health check failed:", err.message);

    res.status(500).json({
      error: "Database connection failed",
    });
  }
});

// =====================================================
// CREATE PRESET
// =====================================================

app.post("/presets", async (req, res) => {
  try {
    const {
      user_id,
      preset_name,
      aspect_ratio,
      watermark_position,
      watermark_scale,
    } = req.body;

    // -------------------------------------------------
    // Validate required fields before querying database
    // -------------------------------------------------

    if (
      user_id === undefined ||
      !String(preset_name || "").trim() ||
      !String(aspect_ratio || "").trim() ||
      !String(watermark_position || "").trim()
    ) {
      return res.status(400).json({
        error:
          "user_id, preset_name, aspect_ratio, and watermark_position are required",
      });
    }

    // -------------------------------------------------
    // Validate watermark scale
    // -------------------------------------------------

    const scale = Number(watermark_scale);

    if (!Number.isFinite(scale) || scale < 1 || scale > 100) {
      return res.status(400).json({
        error: "watermark_scale must be a number from 1 to 100",
      });
    }

    // -------------------------------------------------
    // Insert preset
    //
    // IMPORTANT:
    // Your existing database appears to use the column
    // name "watermark_postion" (misspelled).
    //
    // We preserve that database column name so we don't
    // accidentally break your existing database.
    //
    // The API response uses the correct property name:
    // watermark_position
    // -------------------------------------------------

    const result = await pool.query(
      `INSERT INTO watermark_presets
        (
          user_id,
          preset_name,
          aspect_ratio,
          watermark_postion,
          watermark_scale
        )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         id,
         user_id,
         preset_name,
         aspect_ratio,
         watermark_postion AS watermark_position,
         watermark_scale`,
      [
        user_id,
        String(preset_name).trim(),
        String(aspect_ratio).trim(),
        String(watermark_position).trim(),
        scale,
      ],
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Preset creation error:", err.message);

    return res.status(500).json({
      error: "Server error while creating preset",
    });
  }
});

// =====================================================
// GET PRESETS
// =====================================================

app.get("/presets", async (req, res) => {
  try {
    const userId = req.query.user_id;

    let query;
    let values = [];

    // -------------------------------------------------
    // If user_id is supplied, only return that user's
    // presets.
    // -------------------------------------------------

    if (userId !== undefined) {
      query = `
        SELECT
          id,
          user_id,
          preset_name,
          aspect_ratio,
          watermark_postion AS watermark_position,
          watermark_scale
        FROM watermark_presets
        WHERE user_id = $1
        ORDER BY id DESC
        LIMIT 100
      `;

      values = [userId];
    } else {
      // -------------------------------------------------
      // Otherwise return the latest 100 presets.
      // -------------------------------------------------

      query = `
        SELECT
          id,
          user_id,
          preset_name,
          aspect_ratio,
          watermark_postion AS watermark_position,
          watermark_scale
        FROM watermark_presets
        ORDER BY id DESC
        LIMIT 100
      `;
    }

    const result = await pool.query(query, values);

    return res.json(result.rows);
  } catch (err) {
    console.error("Preset fetch error:", err.message);

    return res.status(500).json({
      error: "Server error while fetching presets",
    });
  }
});

// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    error: "Internal server error",
  });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

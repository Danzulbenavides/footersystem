const express = require("express");
const cors = require("cors");
const pool = require("./db");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Database connection successful",
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Database connection failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.post("/presets", async (req, res) => {
  try {
    const {
      user_id,
      preset_name,
      aspect_ratio,
      watermark_position,
      watermark_scale,
    } = req.body;

    const newPreset = await pool.query(
      `INSERT INTO watermark_presets (user_id, preset_name, aspect_ratio, watermark_postion, watermark_scale)
            VALUE ($1, $2, $3 $4, $5) 
            RETURNING *`,
      [user_id, preset_name, aspect_ratio, watermark_position, watermark_scale],
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error while creating preset" });
  }
});

app.get("/presets", async (req, res) => {
  try {
    const allPresets = await pool.query("SELECT * FROM watermark_presets");
    res.json(allPresets.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error while fetching presets" });
  }
});

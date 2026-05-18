import React, { useEffect, useState } from "react";
import { FileUploader } from "./components";
import "./App.css";

function App() {
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [watermarkFile, setWatermarkFile] = useState(null);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");

  // --- LOCKED IMAGE DIMENSIONS ---
  const TARGET_WIDTH = 5955;
  const TARGET_HEIGHT = 3970;

  const fetchPresets = async () => {
    try {
      const response = await fetch("https://footersystem.onrender.com/presets");
      const data = await response.json();
      setPresets(data);
    } catch (error) {
      console.error("failed to fetch presets: ", error);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleSavePreset = async () => {
    if (!presetName) {
      alert("Please enter a preset name!");
      return;
    }

    try {
      const response = await fetch(
        "https://footersystem.onrender.com/presets",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: 1,
            preset_name: presetName,
            aspect_ratio: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
            watermark_position: "bottom-left",
            watermark_scale: 100,
          }),
        },
      );

      if (response.ok) {
        alert("Preset saved successfully!");
        setPresetName("");
        fetchPresets();
      }
    } catch (error) {
      console.error("Failed to save preset:", error);
    }
  };

  const loadImage = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const triggerDownload = (dataUrl, filename) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `watermarked_${filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const processImages = async () => {
    if (!watermarkFile || galleryFiles.length === 0) {
      alert("Please upload both gallery photos and a watermark image first!");
      return;
    }

    try {
      const watermarkImg = await loadImage(watermarkFile);

      for (const file of galleryFiles) {
        const baseImg = await loadImage(file);

        // Create an invisible canvas locked to specific dimensions
        const canvas = document.createElement("canvas");
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext("2d");

        // --- NEW: COVER / CROP MATH ---
        // 1. Find the scale factor needed to cover the canvas completely
        const scale = Math.max(
          TARGET_WIDTH / baseImg.width,
          TARGET_HEIGHT / baseImg.height,
        );

        // 2. Calculate the new scaled dimensions
        const scaledWidth = baseImg.width * scale;
        const scaledHeight = baseImg.height * scale;

        // 3. Calculate offsets to center the image before cropping
        const offsetX = (TARGET_WIDTH - scaledWidth) / 2;
        const offsetY = (TARGET_HEIGHT - scaledHeight) / 2;

        // Draw the image using the offsets and scaled sizes to mimic "object-fit: cover"
        ctx.drawImage(baseImg, offsetX, offsetY, scaledWidth, scaledHeight);
        // ------------------------------

        // Calculate watermark size relative to the locked canvas width
        const scaleFactor = 0.08;
        const wmWidth = canvas.width * scaleFactor;
        const wmHeight = (watermarkImg.height / watermarkImg.width) * wmWidth;

        // Lock positioning to BOTTOM-LEFT only
        const padding = canvas.width * 0.02;
        const x = padding;
        const y = canvas.height - wmHeight - padding;

        // Stamp the watermark
        ctx.drawImage(watermarkImg, x, y, wmWidth, wmHeight);

        // Convert the canvas back to an image and download it
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        triggerDownload(dataUrl, file.name);
      }

      alert("All images processed successfully!");
    } catch (error) {
      console.error("Error processing images:", error);
      alert("Something went wrong while processing the images.");
    }
  };

  return (
    <div
      className="App"
      style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}
    >
      <h1>Bulk Photo Watermarking System</h1>
      <hr />

      {/* --- SECTION 1: DATABASE SETTINGS --- */}
      <section
        style={{
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
        }}
      >
        <h2>1. Configure Settings</h2>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            alignItems: "flex-end",
            marginBottom: "1rem",
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Preset Name
            </label>
            <input
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="e.g., My Facebook Settings"
              style={{ width: "100%", padding: "0.5rem" }}
            />
          </div>

          <button
            onClick={handleSavePreset}
            style={{
              padding: "0.6rem 1.2rem",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              height: "40px",
            }}
          >
            Save to Database
          </button>
        </div>

        {/* Display Fetched Presets */}
        <div>
          <h3>Saved Presets (From PostgreSQL)</h3>
          <ul>
            {presets.length === 0 ? <p>No presets saved yet.</p> : null}
            {presets.map((p) => (
              <li key={p.id}>
                <strong>{p.preset_name}</strong>: {p.watermark_position} (
                {p.aspect_ratio})
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* --- SECTION 2: UPLOADS --- */}
      <section>
        <h2>2. Upload Assets</h2>
        <div style={{ display: "flex", gap: "2rem" }}>
          <div style={{ flex: 1 }}>
            <h3>Gallery Photos (Bulk)</h3>
            <FileUploader
              allowMultiple={true}
              onFilesSelected={(files) => setGalleryFiles(files)}
            />
            {galleryFiles.length > 0 && (
              <p style={{ fontSize: "0.8rem", color: "green" }}>
                App.jsx knows you uploaded {galleryFiles.length} photos.
              </p>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h3>Watermark Image (Single)</h3>
            <FileUploader
              allowMultiple={false}
              onFilesSelected={(files) => setWatermarkFile(files[0])}
            />
            {watermarkFile && (
              <p style={{ fontSize: "0.8rem", color: "green" }}>
                App.jsx has the watermark: {watermarkFile.name}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* --- SECTION 3: PROCESS BUTTON --- */}
      <section style={{ marginTop: "3rem", textAlign: "center" }}>
        <button
          onClick={processImages}
          disabled={galleryFiles.length === 0 || !watermarkFile}
          style={{
            padding: "1rem 2rem",
            fontSize: "1.2rem",
            backgroundColor:
              galleryFiles.length > 0 && watermarkFile ? "#28a745" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor:
              galleryFiles.length > 0 && watermarkFile
                ? "pointer"
                : "not-allowed",
            fontWeight: "bold",
          }}
        >
          Process & Download{" "}
          {galleryFiles.length > 0 ? galleryFiles.length : ""} Photos
        </button>
      </section>
    </div>
  );
}

export default App;

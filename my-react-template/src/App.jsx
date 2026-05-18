import React, { useEffect, useState } from "react";
import { FileUploader } from "./components";
import JSZip from "jszip";
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

      // If server responds with a valid array, use it and update our local backup
      if (Array.isArray(data)) {
        setPresets(data);
        localStorage.setItem("offline_presets", JSON.stringify(data));
      } else {
        throw new Error("Invalid server data");
      }
    } catch (error) {
      console.warn(
        "Failed to reach server. Loading offline presets from device memory...",
      );

      // Fallback: Read from the device's local memory
      const savedLocalPresets = localStorage.getItem("offline_presets");
      if (savedLocalPresets) {
        setPresets(JSON.parse(savedLocalPresets));
      }
    }
  };

  const handleSavePreset = async () => {
    if (!presetName) {
      alert("Please enter a preset name!");
      return;
    }

    // Create a local preset object just in case we are offline
    const localPresetObj = {
      id: Date.now(), // temporary unique ID
      preset_name: presetName,
      aspect_ratio: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
      watermark_position: "bottom-left",
      watermark_scale: 100,
    };

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
        alert("Preset saved successfully to cloud database!");
        setPresetName("");
        fetchPresets();
      } else {
        throw new Error("Server rejected save");
      }
    } catch (error) {
      console.warn(
        "Could not save to cloud server. Saving locally to this device...",
      );

      // Fallback: Save directly inside the browser's local memory
      const savedLocalPresets = localStorage.getItem("offline_presets");
      const currentList = savedLocalPresets
        ? JSON.parse(savedLocalPresets)
        : [];
      const updatedList = [...currentList, localPresetObj];

      localStorage.setItem("offline_presets", JSON.stringify(updatedList));
      setPresets(updatedList); // Update layout immediately

      alert("Saved to device memory! (You are currently offline)");
      setPresetName("");
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
            {!Array.isArray(presets) || presets.length === 0 ? (
              <p>No presets saved yet or server error.</p>
            ) : (
              presets.map((p) => (
                <li key={p.id}>
                  <strong>{p.preset_name}</strong>: {p.watermark_position} (
                  {p.aspect_ratio})
                </li>
              ))
            )}
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

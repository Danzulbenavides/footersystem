import React, { useEffect, useState } from "react";
import { FileUploader } from "./components";
import JSZip from "jszip";
import "./App.css";

// Import your footer directly from the src/assets folder
import lockedFooter from "./assets/footer-03.png";

function App() {
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [presets, setPresets] = useState([]);
  const [presetName, setPresetName] = useState("");

  // This holds our offline-safe footer image source
  const [footerSource, setFooterSource] = useState(null);

  // --- LOCKED DIMENSIONS ---
  const TARGET_WIDTH = 5955;
  const TARGET_HEIGHT = 3970;

  // Cache the system footer into device memory for offline use
  useEffect(() => {
    const cacheFooterImage = async () => {
      try {
        const response = await fetch(lockedFooter);
        const blob = await response.blob();

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result;
          localStorage.setItem("offline_system_footer", base64Data);
          setFooterSource(base64Data);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        console.warn("Offline: Fetching footer from local device cache...");
        const savedFooter = localStorage.getItem("offline_system_footer");
        if (savedFooter) {
          setFooterSource(savedFooter);
        }
      }
    };

    cacheFooterImage();
  }, []);

  // Smart Fetch: Tries cloud first, falls back to device storage if offline
  const fetchPresets = async () => {
    try {
      const response = await fetch("https://footersystem.onrender.com/presets");
      const data = await response.json();

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

      const savedLocalPresets = localStorage.getItem("offline_presets");
      if (savedLocalPresets) {
        setPresets(JSON.parse(savedLocalPresets));
      }
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  // Smart Save: Tries database first, saves to device storage if offline
  const handleSavePreset = async () => {
    if (!presetName) {
      alert("Please enter a preset name!");
      return;
    }

    const localPresetObj = {
      id: Date.now(),
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

      const savedLocalPresets = localStorage.getItem("offline_presets");
      const currentList = savedLocalPresets
        ? JSON.parse(savedLocalPresets)
        : [];
      const updatedList = [...currentList, localPresetObj];

      localStorage.setItem("offline_presets", JSON.stringify(updatedList));
      setPresets(updatedList);

      alert("Saved to device memory! (You are currently offline)");
      setPresetName("");
    }
  };

  const loadImage = (source) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to render image asset."));

      if (source instanceof Blob || source instanceof File) {
        img.src = URL.createObjectURL(source);
      } else {
        img.src = source;
      }
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
    if (galleryFiles.length === 0) {
      alert("Please upload gallery photos first!");
      return;
    }

    if (!footerSource) {
      alert("System footer is still initializing. Please wait a brief moment.");
      return;
    }

    try {
      const watermarkImg = await loadImage(footerSource);
      const zip = new JSZip();

      for (const file of galleryFiles) {
        const baseImg = await loadImage(file);

        const canvas = document.createElement("canvas");
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext("2d");

        const scale = Math.max(
          TARGET_WIDTH / baseImg.width,
          TARGET_HEIGHT / baseImg.height,
        );

        const scaledWidth = baseImg.width * scale;
        const scaledHeight = baseImg.height * scale;

        const offsetX = (TARGET_WIDTH - scaledWidth) / 2;
        const offsetY = (TARGET_HEIGHT - scaledHeight) / 2;

        ctx.drawImage(baseImg, offsetX, offsetY, scaledWidth, scaledHeight);

        const scaleFactor = 0.08;
        const wmWidth = canvas.width * scaleFactor;
        const wmHeight = (watermarkImg.height / watermarkImg.width) * wmWidth;

        const padding = canvas.width * 0.02;
        const x = padding;
        const y = canvas.height - wmHeight - padding;

        ctx.drawImage(watermarkImg, x, y, wmWidth, wmHeight);

        // SPEED OPTIMIZATION 1: Convert directly to a raw binary Blob instead of a heavy string
        const blobData = await new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
        });

        zip.file(`watermarked_${file.name}`, blobData);
      }

      // SPEED OPTIMIZATION 2: Use "STORE" (0 compression layout).
      // This bypasses the zip compression algorithms completely because JPEGs are already compressed anyway!
      const zipContent = await zip.generateAsync({
        type: "blob",
        compression: "STORE",
      });

      const zipUrl = URL.createObjectURL(zipContent);
      triggerDownload(zipUrl, "watermarked_photos.zip");

      alert("All images processed and zipped successfully!");
    } catch (error) {
      console.error("Error processing images:", error);
      alert(
        "Something went wrong while processing. Check console for details.",
      );
    }
  };

  return (
    <div
      className="App"
      style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}
    >
      <h1>Bulk Photo Watermarking System</h1>
      <hr />

      {/* --- SECTION 1: SETTINGS --- */}
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
            Save Preset
          </button>
        </div>

        {/* Display Fetched Presets */}
        <div>
          <h3>Available Presets</h3>
          <ul>
            {!Array.isArray(presets) || presets.length === 0 ? (
              <p>No presets loaded. Create one above!</p>
            ) : (
              presets.map((p) => (
                <li key={p.id}>
                  <strong>{p.preset_name}</strong>:{" "}
                  {p.watermark_position || "bottom-left"} ({p.aspect_ratio})
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* --- SECTION 2: UPLOADS --- */}
      <section>
        <h2>2. Upload Assets</h2>
        <div style={{ display: "block", width: "100%" }}>
          <div style={{ width: "100%" }}>
            <h3>Gallery Photos (Bulk)</h3>
            <FileUploader
              allowMultiple={true}
              onFilesSelected={(files) => setGalleryFiles(files)}
            />
            {galleryFiles.length > 0 && (
              <p style={{ fontSize: "0.8rem", color: "green" }}>
                Ready to process {galleryFiles.length} photos with system footer
                template.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* --- SECTION 3: PROCESS BUTTON --- */}
      <section style={{ marginTop: "3rem", textAlign: "center" }}>
        <button
          onClick={processImages}
          disabled={galleryFiles.length === 0 || !footerSource}
          style={{
            padding: "1rem 2rem",
            fontSize: "1.2rem",
            backgroundColor:
              galleryFiles.length > 0 && footerSource ? "#28a745" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor:
              galleryFiles.length > 0 && footerSource
                ? "pointer"
                : "not-allowed",
            fontWeight: "bold",
          }}
        >
          {!footerSource
            ? "System Initializing..."
            : `Process & Download ${galleryFiles.length > 0 ? galleryFiles.length : ""} Photos`}
        </button>
      </section>
    </div>
  );
}

export default App;

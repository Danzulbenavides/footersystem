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

  // --- NEW: Loading Screen States ---
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState("");

  // This holds our offline-safe footer image source
  const [footerSource, setFooterSource] = useState(null);

  // --- OPTIMIZED DIMENSIONS (For massive speed boost) ---
  const TARGET_WIDTH = 2048;
  const TARGET_HEIGHT = 1365;

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

    // TURN ON THE LOADING SCREEN
    setIsProcessing(true);
    setProgressText("Initializing system...");

    try {
      const watermarkImg = await loadImage(footerSource);
      const zip = new JSZip();

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const scaleFactor = 0.08;
      const wmWidth = TARGET_WIDTH * scaleFactor;
      const wmHeight = (watermarkImg.height / watermarkImg.width) * wmWidth;
      const padding = TARGET_WIDTH * 0.02;
      const wmX = padding;
      const wmY = TARGET_HEIGHT - wmHeight - padding;

      for (let i = 0; i < galleryFiles.length; i++) {
        // UPDATE THE LIVE PROGRESS TEXT
        setProgressText(
          `Processing photo ${i + 1} of ${galleryFiles.length}...`,
        );

        const file = galleryFiles[i];
        const baseImg = await loadImage(file);

        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;

        const scale = Math.max(
          TARGET_WIDTH / baseImg.width,
          TARGET_HEIGHT / baseImg.height,
        );

        const scaledWidth = baseImg.width * scale;
        const scaledHeight = baseImg.height * scale;
        const offsetX = (TARGET_WIDTH - scaledWidth) / 2;
        const offsetY = (TARGET_HEIGHT - scaledHeight) / 2;

        ctx.drawImage(baseImg, offsetX, offsetY, scaledWidth, scaledHeight);
        ctx.drawImage(watermarkImg, wmX, wmY, wmWidth, wmHeight);

        const blobData = await new Promise((resolve) => {
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
        });

        zip.file(`watermarked_${file.name}`, blobData);

        await new Promise((resolve) => setTimeout(resolve, 10));
        ctx.clearRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
      }

      setProgressText("Packaging files into a ZIP... Please wait.");

      const zipContent = await zip.generateAsync({
        type: "blob",
        compression: "STORE",
      });

      const zipUrl = URL.createObjectURL(zipContent);
      triggerDownload(zipUrl, "watermarked_photos.zip");

      setTimeout(() => {
        URL.revokeObjectURL(zipUrl);
      }, 5000);

      alert("All images processed and zipped successfully!");
    } catch (error) {
      console.error("Error processing images:", error);
      alert(
        "Something went wrong while processing. Check console for details.",
      );
    } finally {
      // TURN OFF THE LOADING SCREEN WHETHER IT SUCCEEDS OR FAILS
      setIsProcessing(false);
      setProgressText("");
    }
  };

  return (
    <div
      className="App"
      style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}
    >
      {/* --- FULL SCREEN LOADING OVERLAY --- */}
      {isProcessing && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999, // Ensures it sits on top of everything else
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          {/* Simple CSS Spinner */}
          <div
            style={{
              width: "50px",
              height: "50px",
              border: "5px solid #f3f3f3",
              borderTop: "5px solid #007bff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              marginBottom: "1.5rem",
            }}
          />
          <h2 style={{ margin: "0 0 1rem 0", color: "#ffffff" }}>
            {progressText}
          </h2>
          <p style={{ color: "#aaaaaa", margin: 0 }}>
            Please do not close or refresh this tab.
          </p>

          {/* Injecting keyframes for the spinner locally */}
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )}

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
          disabled={galleryFiles.length === 0 || !footerSource || isProcessing}
          style={{
            padding: "1rem 2rem",
            fontSize: "1.2rem",
            backgroundColor:
              galleryFiles.length > 0 && footerSource && !isProcessing
                ? "#28a745"
                : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor:
              galleryFiles.length > 0 && footerSource && !isProcessing
                ? "pointer"
                : "not-allowed",
            fontWeight: "bold",
          }}
        >
          {!footerSource
            ? "System Initializing..."
            : isProcessing
              ? "Processing..."
              : `Process & Download ${galleryFiles.length > 0 ? galleryFiles.length : ""} Photos`}
        </button>
      </section>
    </div>
  );
}

export default App;

import React, { useCallback, useEffect, useState } from "react";
import { FileUploader } from "./components";
import JSZip from "jszip";
import "./App.css";

import lockedFooter from "./assets/footer-03.png";

// =====================================================
// CONFIGURATION
// =====================================================

const API_BASE_URL = "https://footersystem.onrender.com";

const TARGET_WIDTH = 2048;
const TARGET_HEIGHT = 1365;

// Good balance between quality and file size.
const JPEG_QUALITY = 0.85;

// Maximum number of images processed at once.
// Keeping this controlled prevents excessive RAM usage.
const getConcurrency = () => {
  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;

  return Math.min(3, Math.max(1, cores - 1));
};

// =====================================================
// IMAGE HELPERS
// =====================================================

const loadImage = async (source) => {
  // Uploaded File/Blob
  if (typeof Blob !== "undefined" && source instanceof Blob) {
    // Fast path for modern browsers
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(source);
      } catch (error) {
        console.warn("createImageBitmap failed. Falling back to Image:", error);
      }
    }

    // Fallback for compatibility
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(source);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to render image asset."));
      };

      img.src = objectUrl;
    });
  }

  // String / bundled asset
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);

    img.onerror = () => reject(new Error("Failed to render image asset."));

    img.src = source;
  });
};

const canvasToBlob = (canvas, type = "image/jpeg", quality = JPEG_QUALITY) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to encode processed image."));
        }
      },
      type,
      quality,
    );
  });
};

// =====================================================
// PROCESS ONE IMAGE
// =====================================================

const processSingleImage = async (
  file,
  watermarkImg,
  watermarkWidth,
  watermarkHeight,
  watermarkX,
  watermarkY,
) => {
  const baseImg = await loadImage(file);

  const canvas = document.createElement("canvas");

  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;

  const ctx = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: false,
  });

  if (!ctx) {
    if (typeof baseImg.close === "function") {
      baseImg.close();
    }

    throw new Error("Canvas rendering is not supported.");
  }

  // ===================================================
  // IMAGE QUALITY SETTINGS
  // ===================================================

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // ===================================================
  // CALCULATE COVER SCALE
  // ===================================================

  const scale = Math.max(
    TARGET_WIDTH / baseImg.width,
    TARGET_HEIGHT / baseImg.height,
  );

  const scaledWidth = baseImg.width * scale;

  const scaledHeight = baseImg.height * scale;

  const offsetX = (TARGET_WIDTH - scaledWidth) / 2;

  const offsetY = (TARGET_HEIGHT - scaledHeight) / 2;

  // ===================================================
  // DRAW BASE IMAGE
  // ===================================================

  ctx.drawImage(baseImg, offsetX, offsetY, scaledWidth, scaledHeight);

  // ===================================================
  // DRAW WATERMARK
  // ===================================================

  ctx.drawImage(
    watermarkImg,
    watermarkX,
    watermarkY,
    watermarkWidth,
    watermarkHeight,
  );

  // ===================================================
  // EXPORT JPEG
  // ===================================================

  const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);

  // Release ImageBitmap memory when possible.
  if (typeof baseImg.close === "function") {
    baseImg.close();
  }

  return blob;
};

// =====================================================
// MAIN APPLICATION
// =====================================================

function App() {
  const [galleryFiles, setGalleryFiles] = useState([]);

  const [presets, setPresets] = useState([]);

  const [presetName, setPresetName] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  const [progressText, setProgressText] = useState("");

  const [progressPercent, setProgressPercent] = useState(0);

  const [isSavingPreset, setIsSavingPreset] = useState(false);

  // ===================================================
  // LOAD PRESETS
  // ===================================================

  const fetchPresets = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/presets?user_id=1`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("Invalid server preset data");
      }

      setPresets(data);

      // Keep a local copy for fast startup/offline use.
      localStorage.setItem("offline_presets", JSON.stringify(data));
    } catch (error) {
      console.warn("Could not fetch cloud presets:", error);

      // Fall back to cached presets.
      try {
        const saved = localStorage.getItem("offline_presets");

        if (saved) {
          const parsed = JSON.parse(saved);

          if (Array.isArray(parsed)) {
            setPresets(parsed);
          }
        }
      } catch (storageError) {
        console.warn("Could not load local presets:", storageError);
      }
    }
  }, []);

  // ===================================================
  // INITIALIZE
  // ===================================================

  useEffect(() => {
    // Load local data immediately.
    try {
      const saved = localStorage.getItem("offline_presets");

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setPresets(parsed);
        }
      }
    } catch (error) {
      console.warn("Could not read cached presets:", error);
    }

    // Refresh from the cloud in the background.
    fetchPresets();
  }, [fetchPresets]);

  // ===================================================
  // SAVE PRESET
  // ===================================================

  const handleSavePreset = async () => {
    const trimmedName = presetName.trim();

    if (!trimmedName) {
      alert("Please enter a preset name!");
      return;
    }

    setIsSavingPreset(true);

    const localPresetObj = {
      id: `local-${Date.now()}`,
      user_id: 1,
      preset_name: trimmedName,
      aspect_ratio: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
      watermark_position: "bottom-left",
      watermark_scale: 100,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/presets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          user_id: 1,
          preset_name: trimmedName,
          aspect_ratio: `${TARGET_WIDTH}x${TARGET_HEIGHT}`,
          watermark_position: "bottom-left",
          watermark_scale: 100,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || `Server returned ${response.status}`);
      }

      // Use server-created record.
      setPresets((current) => {
        const updated = [
          data,
          ...current.filter((preset) => preset.id !== data.id),
        ];

        localStorage.setItem("offline_presets", JSON.stringify(updated));

        return updated;
      });

      setPresetName("");

      alert("Preset saved successfully!");
    } catch (error) {
      console.warn("Cloud save failed. Saving locally:", error);

      // Offline fallback.
      setPresets((current) => {
        const updated = [localPresetObj, ...current];

        localStorage.setItem("offline_presets", JSON.stringify(updated));

        return updated;
      });

      setPresetName("");

      alert("Preset saved locally because the server is unavailable.");
    } finally {
      setIsSavingPreset(false);
    }
  };

  // ===================================================
  // PROCESS ALL IMAGES
  // ===================================================

  const processImages = async () => {
    if (galleryFiles.length === 0) {
      alert("Please upload gallery photos first!");
      return;
    }

    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    setProgressText("Preparing watermark...");
    setProgressPercent(0);

    try {
      // =================================================
      // LOAD WATERMARK
      // =================================================

      const watermarkImg = await loadImage(lockedFooter);

      // =================================================
      // CREATE ZIP
      // =================================================

      const zip = new JSZip();

      // =================================================
      // WATERMARK SIZE
      // =================================================

      const scaleFactor = 0.08;

      const watermarkWidth = TARGET_WIDTH * scaleFactor;

      const watermarkHeight =
        (watermarkImg.height / watermarkImg.width) * watermarkWidth;

      const padding = TARGET_WIDTH * 0.02;

      const watermarkX = padding;

      const watermarkY = TARGET_HEIGHT - watermarkHeight - padding;

      // =================================================
      // CONTROLLED CONCURRENCY
      // =================================================

      const concurrency = getConcurrency();

      let completed = 0;

      // =================================================
      // PROCESS IN BATCHES
      // =================================================

      for (let start = 0; start < galleryFiles.length; start += concurrency) {
        const batch = galleryFiles.slice(start, start + concurrency);

        const results = await Promise.all(
          batch.map(async (file) => {
            const blob = await processSingleImage(
              file,
              watermarkImg,
              watermarkWidth,
              watermarkHeight,
              watermarkX,
              watermarkY,
            );

            completed += 1;

            const percent = Math.round((completed / galleryFiles.length) * 100);

            setProgressPercent(percent);

            setProgressText(
              `Processing photo ${completed} of ${galleryFiles.length}...`,
            );

            return {
              file,
              blob,
            };
          }),
        );

        // =================================================
        // ADD RESULTS TO ZIP
        // =================================================

        for (const { file, blob } of results) {
          const baseName = file.name.replace(/\.[^/.]+$/, "");

          zip.file(`watermarked_${baseName}.jpg`, blob);
        }

        // =================================================
        // GIVE BROWSER A CHANCE TO UPDATE UI
        // =================================================

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      // =================================================
      // GENERATE ZIP
      // =================================================

      setProgressText("Packaging images into ZIP...");
      setProgressPercent(100);

      const zipContent = await zip.generateAsync(
        {
          type: "blob",

          // JPEG files are already compressed,
          // so STORE avoids unnecessary ZIP CPU work.
          compression: "STORE",
        },
        (metadata) => {
          if (typeof metadata.percent === "number") {
            setProgressText(`Creating ZIP... ${Math.round(metadata.percent)}%`);
          }
        },
      );

      // =================================================
      // DOWNLOAD ZIP
      // =================================================

      const zipUrl = URL.createObjectURL(zipContent);

      const link = document.createElement("a");

      link.href = zipUrl;

      link.download = "watermarked_photos.zip";

      document.body.appendChild(link);

      link.click();

      link.remove();

      // =================================================
      // CLEANUP
      // =================================================

      setTimeout(() => {
        URL.revokeObjectURL(zipUrl);
      }, 1000);

      if (typeof watermarkImg.close === "function") {
        watermarkImg.close();
      }

      alert(
        `${galleryFiles.length} photo${
          galleryFiles.length === 1 ? "" : "s"
        } processed successfully!`,
      );
    } catch (error) {
      console.error("Image processing error:", error);

      alert(
        "Something went wrong while processing the images. Please check the browser console.",
      );
    } finally {
      setIsProcessing(false);
      setProgressText("");
      setProgressPercent(0);
    }
  };

  // ===================================================
  // UI
  // ===================================================

  return (
    <div
      className="App"
      style={{
        padding: "2rem",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      {/* ================================================
          PROCESSING OVERLAY
          ================================================ */}

      {isProcessing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.88)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            color: "white",
            fontFamily: "sans-serif",
            padding: "2rem",
            boxSizing: "border-box",
          }}
        >
          {/* Spinner */}

          <div
            style={{
              width: "50px",
              height: "50px",
              border: "5px solid rgba(255,255,255,0.25)",
              borderTop: "5px solid #ffffff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              marginBottom: "1.5rem",
            }}
          />

          {/* Progress text */}

          <h2
            style={{
              margin: "0 0 1rem 0",
              color: "#ffffff",
              textAlign: "center",
            }}
          >
            {progressText}
          </h2>

          {/* Progress percentage */}

          <div
            style={{
              width: "min(500px, 90vw)",
              height: "10px",
              background: "rgba(255,255,255,0.2)",
              borderRadius: "999px",
              overflow: "hidden",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#ffffff",
                transition: "width 0.2s ease",
              }}
            />
          </div>

          <p
            style={{
              color: "rgba(255,255,255,0.7)",
              margin: 0,
            }}
          >
            {progressPercent}%
          </p>

          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              marginTop: "1rem",
              textAlign: "center",
            }}
          >
            Please do not close or refresh this tab.
          </p>

          <style>
            {`
              @keyframes spin {
                0% {
                  transform: rotate(0deg);
                }

                100% {
                  transform: rotate(360deg);
                }
              }
            `}
          </style>
        </div>
      )}

      {/* ================================================
          TITLE
          ================================================ */}

      <h1>Bulk Photo Watermarking System</h1>

      <hr />

      {/* ================================================
          SECTION 1: PRESETS
          ================================================ */}

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
          <div
            style={{
              flex: 1,
            }}
          >
            <label
              htmlFor="preset-name"
              style={{
                display: "block",
                marginBottom: "0.5rem",
              }}
            >
              Preset Name
            </label>

            <input
              id="preset-name"
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSavePreset();
                }
              }}
              placeholder="e.g., My Facebook Settings"
              maxLength={100}
              disabled={isSavingPreset || isProcessing}
              style={{
                width: "100%",
                padding: "0.5rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleSavePreset}
            disabled={isSavingPreset || isProcessing || !presetName.trim()}
            style={{
              padding: "0.6rem 1.2rem",
              backgroundColor:
                !isSavingPreset && !isProcessing && presetName.trim()
                  ? "#007bff"
                  : "#cccccc",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor:
                !isSavingPreset && !isProcessing && presetName.trim()
                  ? "pointer"
                  : "not-allowed",
              height: "40px",
            }}
          >
            {isSavingPreset ? "Saving..." : "Save Preset"}
          </button>
        </div>

        <div>
          <h3>Available Presets</h3>

          {presets.length === 0 ? (
            <p>No presets loaded. Create one above!</p>
          ) : (
            <ul>
              {presets.map((preset) => (
                <li
                  key={preset.id}
                  style={{
                    marginBottom: "0.5rem",
                  }}
                >
                  <strong>{preset.preset_name}</strong>:{" "}
                  {preset.watermark_position || "bottom-left"} (
                  {preset.aspect_ratio})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ================================================
          SECTION 2: UPLOAD
          ================================================ */}

      <section>
        <h2>2. Upload Assets</h2>

        <div
          style={{
            width: "100%",
          }}
        >
          <h3>Gallery Photos (Bulk)</h3>

          <FileUploader
            allowMultiple={true}
            onFilesSelected={(files) => setGalleryFiles(files)}
          />

          {galleryFiles.length > 0 && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "green",
              }}
            >
              Ready to process {galleryFiles.length} photo
              {galleryFiles.length === 1 ? "" : "s"} with the system footer
              template.
            </p>
          )}
        </div>
      </section>

      {/* ================================================
          SECTION 3: PROCESS
          ================================================ */}

      <section
        style={{
          marginTop: "3rem",
          textAlign: "center",
        }}
      >
        <button
          type="button"
          onClick={processImages}
          disabled={galleryFiles.length === 0 || isProcessing}
          style={{
            padding: "1rem 2rem",
            fontSize: "1.2rem",
            backgroundColor:
              galleryFiles.length > 0 && !isProcessing ? "#28a745" : "#cccccc",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor:
              galleryFiles.length > 0 && !isProcessing
                ? "pointer"
                : "not-allowed",
            fontWeight: "bold",
          }}
        >
          {isProcessing
            ? "Processing..."
            : `Process & Download ${
                galleryFiles.length > 0 ? galleryFiles.length : ""
              } Photos`}
        </button>
      </section>
    </div>
  );
}

export default App;

import React, { useCallback, useEffect, useState } from "react";

import { FileUploader } from "./components";
import JSZip from "jszip";
import "./App.css";

import lockedFooter from "./assets/footer-03.png";

// =====================================================
// CONFIGURATION
// =====================================================

const API_BASE_URL = "https://footersystem.onrender.com";

// Maximum size of the longest side.
//
// Example:
// 6000 × 4000 -> 3000 × 2000
// 4000 × 6000 -> 2000 × 3000
//
// Smaller images are NOT enlarged.
const MAX_DIMENSION = 3000;

// High-quality JPEG output.
const JPEG_QUALITY = 0.9;

// =====================================================
// PROCESSING CONCURRENCY
// =====================================================

// Process a controlled number of images simultaneously.
// This improves speed without consuming excessive RAM.
const getConcurrency = () => {
  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;

  return Math.min(3, Math.max(1, cores - 1));
};

// =====================================================
// BROWSER YIELD
// =====================================================

// Give the browser an opportunity to update the UI
// between processing batches.
const yieldToBrowser = () => {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
};

// =====================================================
// IMAGE LOADING
// =====================================================

const loadImage = async (source) => {
  // ---------------------------------------------------
  // Uploaded File / Blob
  // ---------------------------------------------------

  if (typeof Blob !== "undefined" && source instanceof Blob) {
    // Fast decoding path for modern browsers.
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(source);
      } catch (error) {
        console.warn("createImageBitmap failed. Using fallback:", error);
      }
    }

    // Compatible fallback.
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

  // ---------------------------------------------------
  // Bundled Footer / Normal Image Source
  // ---------------------------------------------------

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error("Failed to render image asset."));
    };

    img.src = source;
  });
};

// =====================================================
// CANVAS -> BLOB
// =====================================================

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

const processSingleImage = async (file, watermarkImg) => {
  const baseImg = await loadImage(file);

  // ---------------------------------------------------
  // CALCULATE OUTPUT SIZE
  //
  // The longest side is limited to 3000px.
  // Aspect ratio is preserved.
  // Smaller images remain unchanged.
  // ---------------------------------------------------

  const longestSide = Math.max(baseImg.width, baseImg.height);

  const resizeScale =
    longestSide > MAX_DIMENSION ? MAX_DIMENSION / longestSide : 1;

  const outputWidth = Math.max(1, Math.round(baseImg.width * resizeScale));

  const outputHeight = Math.max(1, Math.round(baseImg.height * resizeScale));

  // ---------------------------------------------------
  // CREATE CANVAS
  // ---------------------------------------------------

  const canvas = document.createElement("canvas");

  canvas.width = outputWidth;

  canvas.height = outputHeight;

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

  // ---------------------------------------------------
  // HIGH-QUALITY IMAGE SCALING
  // ---------------------------------------------------

  ctx.imageSmoothingEnabled = true;

  ctx.imageSmoothingQuality = "high";

  // ---------------------------------------------------
  // WATERMARK SIZE
  //
  // Approximately 8% of final image width.
  // ---------------------------------------------------

  const watermarkWidth = outputWidth * 0.08;

  const watermarkHeight =
    (watermarkImg.height / watermarkImg.width) * watermarkWidth;

  const padding = outputWidth * 0.02;

  const watermarkX = padding;

  const watermarkY = outputHeight - watermarkHeight - padding;

  // ---------------------------------------------------
  // DRAW BASE IMAGE
  // ---------------------------------------------------

  ctx.drawImage(baseImg, 0, 0, outputWidth, outputHeight);

  // ---------------------------------------------------
  // DRAW WATERMARK
  // ---------------------------------------------------

  ctx.drawImage(
    watermarkImg,
    watermarkX,
    watermarkY,
    watermarkWidth,
    watermarkHeight,
  );

  // ---------------------------------------------------
  // EXPORT JPEG
  // ---------------------------------------------------

  const blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);

  // ---------------------------------------------------
  // RELEASE IMAGE MEMORY
  // ---------------------------------------------------

  if (typeof baseImg.close === "function") {
    baseImg.close();
  }

  return blob;
};

// =====================================================
// APPLICATION
// =====================================================

function App() {
  const [galleryFiles, setGalleryFiles] = useState([]);

  const [presets, setPresets] = useState([]);

  const [presetName, setPresetName] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  const [progressText, setProgressText] = useState("");

  const [progressPercent, setProgressPercent] = useState(0);

  const [isSavingPreset, setIsSavingPreset] = useState(false);

  const [processedImages, setProcessedImages] = useState([]);

  const [isSavingPhotos, setIsSavingPhotos] = useState(false);

  // ===================================================
  // FETCH PRESETS FROM SERVER
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

      // Save latest cloud presets locally.
      localStorage.setItem("offline_presets", JSON.stringify(data));
    } catch (error) {
      console.warn("Could not fetch cloud presets:", error);

      // -------------------------------------------------
      // OFFLINE FALLBACK
      // -------------------------------------------------

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
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    // Load cached presets immediately.
    // This makes startup faster and supports offline use.
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

    // Refresh from the server in the background.
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

      // The preset now represents the
      // automatic 3000px maximum behavior.
      aspect_ratio: `AUTO (max ${MAX_DIMENSION}px)`,

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

          aspect_ratio: `AUTO (max ${MAX_DIMENSION}px)`,

          watermark_position: "bottom-left",

          watermark_scale: 100,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || `Server returned ${response.status}`);
      }

      // -------------------------------------------------
      // UPDATE UI + CACHE
      // -------------------------------------------------

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

      // -------------------------------------------------
      // OFFLINE SAVE
      // -------------------------------------------------

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

    setProcessedImages([]);

    setProgressText("Preparing watermark...");

    setProgressPercent(0);

    try {
      // -------------------------------------------------
      // LOAD FOOTER
      // -------------------------------------------------

      const watermarkImg = await loadImage(lockedFooter);

      // -------------------------------------------------
      // CONTROLLED CONCURRENCY
      // -------------------------------------------------

      const concurrency = getConcurrency();

      let completed = 0;

      const processed = [];

      // -------------------------------------------------
      // PROCESS BATCHES
      // -------------------------------------------------

      for (let start = 0; start < galleryFiles.length; start += concurrency) {
        const batch = galleryFiles.slice(start, start + concurrency);

        // Process 2–3 images simultaneously.
        const results = await Promise.all(
          batch.map(async (file) => {
            const blob = await processSingleImage(file, watermarkImg);

            completed += 1;

            const percent = Math.round((completed / galleryFiles.length) * 100);

            setProgressPercent(percent);

            setProgressText(
              `Processing photo ${completed} of ${galleryFiles.length}...`,
            );

            const baseName = file.name.replace(/\.[^/.]+$/, "");

            return {
              name: `watermarked_${baseName}.jpg`,

              blob,

              originalName: file.name,
            };
          }),
        );

        processed.push(...results);

        // Allow UI to update.
        await yieldToBrowser();
      }

      // -------------------------------------------------
      // STORE PROCESSED IMAGES
      // -------------------------------------------------

      setProcessedImages(processed);

      setProgressPercent(100);

      setProgressText("Photos are ready to save!");

      // Release watermark bitmap.
      if (typeof watermarkImg.close === "function") {
        watermarkImg.close();
      }

      alert(
        `${processed.length} photo${
          processed.length === 1 ? "" : "s"
        } processed successfully!`,
      );
    } catch (error) {
      console.error("Image processing error:", error);

      alert(
        "Something went wrong while processing the images. Please check the browser console.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // ===================================================
  // CHECK NATIVE PHOTO SHARING SUPPORT
  // ===================================================

  const canShareImages = () => {
    if (typeof navigator === "undefined") {
      return false;
    }

    if (
      typeof navigator.share !== "function" ||
      typeof navigator.canShare !== "function"
    ) {
      return false;
    }

    if (processedImages.length === 0) {
      return false;
    }

    try {
      const testFile = new File(
        [processedImages[0].blob],

        processedImages[0].name,

        {
          type: "image/jpeg",
        },
      );

      return navigator.canShare({
        files: [testFile],
      });
    } catch {
      return false;
    }
  };

  // ===================================================
  // SAVE PHOTOS USING DEVICE SHARE
  // ===================================================

  const handleSavePhotos = async () => {
    if (processedImages.length === 0) {
      alert("Please process your photos first.");

      return;
    }

    if (!canShareImages()) {
      alert(
        "This browser does not support native photo sharing. Please use Save to Folder or Download ZIP.",
      );

      return;
    }

    setIsSavingPhotos(true);

    try {
      const files = processedImages.map(
        ({ blob, name }) =>
          new File([blob], name, {
            type: "image/jpeg",

            lastModified: Date.now(),
          }),
      );

      await navigator.share({
        files,

        title: "Watermarked Photos",

        text: "Watermarked photos created with FooterSystem.",
      });
    } catch (error) {
      // User closing the share menu is normal.
      if (error?.name !== "AbortError") {
        console.error("Photo sharing failed:", error);

        alert(
          "The device could not share these photos. Please use another save option.",
        );
      }
    } finally {
      setIsSavingPhotos(false);
    }
  };

  // ===================================================
  // CHECK FOLDER SAVE SUPPORT
  // ===================================================

  const canSaveToFolder =
    typeof window !== "undefined" && "showDirectoryPicker" in window;

  // ===================================================
  // SAVE DIRECTLY TO SELECTED FOLDER
  // ===================================================

  const handleSaveToFolder = async () => {
    if (processedImages.length === 0) {
      alert("Please process your photos first.");

      return;
    }

    if (!canSaveToFolder) {
      alert(
        "Your browser does not support direct folder saving. Please use Download ZIP instead.",
      );

      return;
    }

    setIsSavingPhotos(true);

    try {
      // Ask the user to select a folder.
      const directoryHandle = await window.showDirectoryPicker({
        mode: "readwrite",
      });

      // Save each image individually.
      for (const { blob, name } of processedImages) {
        const fileHandle = await directoryHandle.getFileHandle(name, {
          create: true,
        });

        const writable = await fileHandle.createWritable();

        await writable.write(blob);

        await writable.close();
      }

      alert(
        `${processedImages.length} photo${
          processedImages.length === 1 ? "" : "s"
        } saved successfully!`,
      );
    } catch (error) {
      // User cancelled the folder picker.
      if (error?.name === "AbortError") {
        return;
      }

      console.error("Folder save failed:", error);

      alert("Could not save the photos to the selected folder.");
    } finally {
      setIsSavingPhotos(false);
    }
  };

  // ===================================================
  // DOWNLOAD ZIP
  // ===================================================

  const handleDownloadZip = async () => {
    if (processedImages.length === 0) {
      alert("Please process your photos first.");

      return;
    }

    setIsSavingPhotos(true);

    setProgressText("Creating ZIP...");

    setProgressPercent(0);

    try {
      const zip = new JSZip();

      // Add processed JPEG files.
      for (const { blob, name } of processedImages) {
        zip.file(name, blob);
      }

      // JPEG files are already compressed,
      // so STORE avoids unnecessary CPU work.
      const zipContent = await zip.generateAsync(
        {
          type: "blob",
          compression: "STORE",
        },

        (metadata) => {
          if (typeof metadata.percent === "number") {
            const percent = Math.round(metadata.percent);

            setProgressPercent(percent);

            setProgressText(`Creating ZIP... ${percent}%`);
          }
        },
      );

      const zipUrl = URL.createObjectURL(zipContent);

      const link = document.createElement("a");

      link.href = zipUrl;

      link.download = "watermarked_photos.zip";

      document.body.appendChild(link);

      link.click();

      link.remove();

      // Release memory.
      setTimeout(() => {
        URL.revokeObjectURL(zipUrl);
      }, 1000);

      setProgressText("");

      setProgressPercent(0);

      alert("ZIP downloaded successfully!");
    } catch (error) {
      console.error("ZIP creation failed:", error);

      alert("Could not create the ZIP file.");
    } finally {
      setIsSavingPhotos(false);
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
      {/* =================================================
          PROCESSING OVERLAY
          ================================================= */}

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

          <h2
            style={{
              margin: "0 0 1rem 0",

              color: "#ffffff",

              textAlign: "center",
            }}
          >
            {progressText}
          </h2>

          {/* Progress Bar */}

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

      {/* =================================================
          TITLE
          ================================================= */}

      <h1>Bulk Photo Watermarking System</h1>

      <hr />

      {/* =================================================
          SECTION 1: SETTINGS
          ================================================= */}

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
              placeholder="e.g., Facebook Photos"
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

        {/* Output Information */}

        <div
          style={{
            marginBottom: "1rem",

            padding: "0.75rem",

            background: "#ffffff",

            border: "1px solid #e5e7eb",

            borderRadius: "6px",

            fontSize: "0.9rem",
          }}
        >
          <strong>Output settings:</strong>
          <br />
          Maximum {MAX_DIMENSION}px on the longest side.
          <br />
          JPEG quality: {Math.round(JPEG_QUALITY * 100)}
          %.
          <br />
          Original aspect ratio preserved.
          <br />
          Smaller images are not enlarged.
        </div>

        {/* Presets */}

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
                  {preset.watermark_position || "bottom-left"}
                  {" ("}
                  {preset.aspect_ratio || `AUTO (max ${MAX_DIMENSION}px)`}
                  {")"}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* =================================================
          SECTION 2: UPLOAD
          ================================================= */}

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
            onFilesSelected={(files) => {
              setGalleryFiles(files);

              // New selection means
              // previous results are no longer current.
              setProcessedImages([]);
            }}
          />

          {galleryFiles.length > 0 && (
            <p
              style={{
                fontSize: "0.8rem",

                color: "green",
              }}
            >
              Ready to process {galleryFiles.length} photo
              {galleryFiles.length === 1 ? "" : "s"} with system footer
              template.
            </p>
          )}
        </div>
      </section>

      {/* =================================================
          SECTION 3: PROCESS
          ================================================= */}

      <section
        style={{
          marginTop: "3rem",

          textAlign: "center",
        }}
      >
        {/* Process Button */}

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
            : `Process ${
                galleryFiles.length > 0 ? galleryFiles.length : ""
              } Photos`}
        </button>

        {/* =================================================
            SAVE OPTIONS
            ================================================= */}

        {processedImages.length > 0 && (
          <div
            style={{
              marginTop: "1.5rem",

              display: "flex",

              flexWrap: "wrap",

              gap: "0.75rem",

              justifyContent: "center",
            }}
          >
            {/* -------------------------------------------
                MOBILE / NATIVE SHARE
                ------------------------------------------- */}

            {canShareImages() && (
              <button
                type="button"
                onClick={handleSavePhotos}
                disabled={isSavingPhotos}
                style={{
                  padding: "0.8rem 1.2rem",

                  backgroundColor: "#007bff",

                  color: "white",

                  border: "none",

                  borderRadius: "8px",

                  cursor: isSavingPhotos ? "not-allowed" : "pointer",

                  fontWeight: "600",

                  opacity: isSavingPhotos ? 0.7 : 1,
                }}
              >
                {isSavingPhotos ? "Saving..." : "📱 Save Photos"}
              </button>
            )}

            {/* -------------------------------------------
                DESKTOP / FOLDER SAVE
                ------------------------------------------- */}

            {canSaveToFolder && (
              <button
                type="button"
                onClick={handleSaveToFolder}
                disabled={isSavingPhotos}
                style={{
                  padding: "0.8rem 1.2rem",

                  backgroundColor: "#6f42c1",

                  color: "white",

                  border: "none",

                  borderRadius: "8px",

                  cursor: isSavingPhotos ? "not-allowed" : "pointer",

                  fontWeight: "600",

                  opacity: isSavingPhotos ? 0.7 : 1,
                }}
              >
                📁 Save to Folder
              </button>
            )}

            {/* -------------------------------------------
                UNIVERSAL ZIP FALLBACK
                ------------------------------------------- */}

            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={isSavingPhotos}
              style={{
                padding: "0.8rem 1.2rem",

                backgroundColor: "#444444",

                color: "white",

                border: "none",

                borderRadius: "8px",

                cursor: isSavingPhotos ? "not-allowed" : "pointer",

                fontWeight: "600",

                opacity: isSavingPhotos ? 0.7 : 1,
              }}
            >
              📦 Download ZIP
            </button>
          </div>
        )}

        {/* =================================================
            OUTPUT DESCRIPTION
            ================================================= */}

        <p
          style={{
            marginTop: "0.75rem",

            fontSize: "0.8rem",

            color: "#64748b",
          }}
        >
          Maximum {MAX_DIMENSION}px on the longest side · JPEG{" "}
          {Math.round(JPEG_QUALITY * 100)}% · aspect ratio preserved · no
          upscaling
        </p>

        {processedImages.length > 0 && (
          <p
            style={{
              marginTop: "0.5rem",

              fontSize: "0.85rem",

              color: "#334155",
            }}
          >
            {processedImages.length} processed photo
            {processedImages.length === 1 ? "" : "s"} ready to save.
          </p>
        )}
      </section>
    </div>
  );
}

export default App;

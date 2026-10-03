import React, { useEffect, useRef, useState } from "react";

import styles from "./FileUploader.module.css";

const MAX_FILES = 100;

const FileUploader = ({ onFilesSelected, allowMultiple = false }) => {
  const hiddenFileInput = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [previewUrls, setPreviewUrls] = useState([]);

  const [dragActive, setDragActive] = useState(false);

  const [error, setError] = useState(null);

  // =====================================================
  // CREATE PREVIEW URLS ONLY WHEN FILES CHANGE
  // =====================================================

  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));

    setPreviewUrls(urls);

    // Release URLs when files change
    // or component unmounts.
    return () => {
      urls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [selectedFiles]);

  // =====================================================
  // VALIDATE FILES
  // =====================================================

  const validateAndSetFiles = (files) => {
    setError(null);

    if (!files.length) {
      return;
    }

    // Only allow actual image files.
    const validImages = files.filter((file) => file.type.startsWith("image/"));

    if (validImages.length === 0) {
      setError("Please upload valid image files.");
      return;
    }

    // ---------------------------------------------------
    // Single-image mode
    // ---------------------------------------------------

    if (!allowMultiple) {
      const selected = [validImages[0]];

      setSelectedFiles(selected);

      if (onFilesSelected) {
        onFilesSelected(selected);
      }

      return;
    }

    // ---------------------------------------------------
    // Bulk mode
    // ---------------------------------------------------

    const limitedFiles = validImages.slice(0, MAX_FILES);

    if (validImages.length > MAX_FILES) {
      setError(`Only the first ${MAX_FILES} images were selected.`);
    }

    setSelectedFiles(limitedFiles);

    if (onFilesSelected) {
      onFilesSelected(limitedFiles);
    }
  };

  // =====================================================
  // FILE INPUT
  // =====================================================

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);

    validateAndSetFiles(files);

    // Allows selecting the same file again later.
    event.target.value = "";
  };

  // =====================================================
  // DRAG EVENTS
  // =====================================================

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    }

    if (event.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);

    const files = Array.from(event.dataTransfer?.files || []);

    validateAndSetFiles(files);
  };

  // =====================================================
  // OPEN FILE PICKER
  // =====================================================

  const openFilePicker = () => {
    if (hiddenFileInput.current) {
      hiddenFileInput.current.click();
    }
  };

  // =====================================================
  // KEYBOARD ACCESSIBILITY
  // =====================================================

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  };

  // =====================================================
  // CLEAR FILES
  // =====================================================

  const clearFiles = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setSelectedFiles([]);
    setPreviewUrls([]);
    setError(null);

    if (hiddenFileInput.current) {
      hiddenFileInput.current.value = "";
    }

    if (onFilesSelected) {
      onFilesSelected([]);
    }
  };

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div
      className={styles.dropzone}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={openFilePicker}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Upload image files"
      style={{
        backgroundColor: dragActive ? "#e0f2fe" : "transparent",

        border: "2px dashed #cbd5e1",

        padding: "2rem",

        borderRadius: "8px",

        textAlign: "center",

        cursor: "pointer",

        transition: "background-color 0.2s ease, border-color 0.2s ease",

        position: "relative",
      }}
    >
      {/* ================================================
          PREVIEWS
          ================================================ */}

      {selectedFiles.length > 0 ? (
        <div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              justifyContent: "center",
            }}
          >
            {previewUrls.map((url, index) => (
              <div
                key={url}
                style={{
                  width: "80px",
                  height: "80px",
                  overflow: "hidden",
                  borderRadius: "8px",
                  position: "relative",
                }}
              >
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            ))}
          </div>

          <p
            style={{
              marginTop: "1rem",
              marginBottom: "0.5rem",
            }}
          >
            {selectedFiles.length} file
            {selectedFiles.length === 1 ? "" : "s"} selected
          </p>

          <p
            style={{
              fontSize: "0.8rem",
              color: "#64748b",
              margin: "0 0 1rem 0",
            }}
          >
            Click or drop new images to replace this selection.
          </p>

          <button
            type="button"
            onClick={clearFiles}
            onKeyDown={(event) => event.stopPropagation()}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            Clear Selection
          </button>
        </div>
      ) : (
        <div>
          <p
            style={{
              margin: "0 0 0.5rem 0",
              fontWeight: "600",
            }}
          >
            Drag and drop image
            {allowMultiple ? "s" : ""} here
          </p>

          <p
            style={{
              margin: "0",
              color: "#64748b",
            }}
          >
            or click to browse
          </p>

          {allowMultiple && (
            <p
              style={{
                margin: "0.5rem 0 0 0",
                fontSize: "0.8rem",
                color: "#94a3b8",
              }}
            >
              Maximum {MAX_FILES} images
            </p>
          )}
        </div>
      )}

      {/* ================================================
          ERROR
          ================================================ */}

      {error && (
        <p
          style={{
            color: "#dc2626",
            marginTop: "1rem",
            marginBottom: 0,
          }}
        >
          {error}
        </p>
      )}

      {/* ================================================
          HIDDEN FILE INPUT
          ================================================ */}

      <input
        accept="image/*"
        multiple={allowMultiple}
        onChange={handleFileChange}
        type="file"
        ref={hiddenFileInput}
        style={{
          display: "none",
        }}
      />
    </div>
  );
};

export default FileUploader;

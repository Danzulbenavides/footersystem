import React, { useEffect, useRef, useState } from "react";

import styles from "./FileUploader.module.css";

// Maximum number of images allowed in bulk mode.
const MAX_FILES = 100;

const FileUploader = ({ onFilesSelected, allowMultiple = false }) => {
  const hiddenFileInput = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState([]);

  const [previewItems, setPreviewItems] = useState([]);

  const previewUrlsRef = useRef([]);

  const [dragActive, setDragActive] = useState(false);

  const [error, setError] = useState(null);

  // =====================================================
  // CLEAN UP PREVIEW URLS
  // =====================================================

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });

      previewUrlsRef.current = [];
    };
  }, []);

  // =====================================================
  // REPLACE CURRENT SELECTION
  // =====================================================

  const replaceSelectedFiles = (files) => {
    // Release previous object URLs.
    previewUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    previewUrlsRef.current = [];

    // Create new preview URLs once.
    const items = files.map((file) => {
      const url = URL.createObjectURL(file);

      previewUrlsRef.current.push(url);

      return {
        file,
        url,
      };
    });

    setSelectedFiles(files);
    setPreviewItems(items);

    if (onFilesSelected) {
      onFilesSelected(files);
    }
  };

  // =====================================================
  // VALIDATE FILES
  // =====================================================

  const validateAndSetFiles = (files) => {
    setError(null);

    if (!files.length) {
      return;
    }

    // Only allow image files.
    const validImages = files.filter((file) => file.type.startsWith("image/"));

    if (validImages.length === 0) {
      setError("Please upload valid image files.");

      return;
    }

    // ---------------------------------------------------
    // SINGLE IMAGE MODE
    // ---------------------------------------------------

    if (!allowMultiple) {
      replaceSelectedFiles([validImages[0]]);

      return;
    }

    // ---------------------------------------------------
    // BULK IMAGE MODE
    // ---------------------------------------------------

    const limitedFiles = validImages.slice(0, MAX_FILES);

    if (validImages.length > MAX_FILES) {
      setError(`Only the first ${MAX_FILES} images were selected.`);
    }

    replaceSelectedFiles(limitedFiles);
  };

  // =====================================================
  // FILE INPUT
  // =====================================================

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);

    validateAndSetFiles(files);

    // Allows the same file to be selected again.
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

  // =====================================================
  // DROP
  // =====================================================

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
  // CLEAR SELECTION
  // =====================================================

  const clearFiles = (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Release object URLs.
    previewUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });

    previewUrlsRef.current = [];

    setSelectedFiles([]);
    setPreviewItems([]);
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
      {/* =================================================
          PREVIEWS
          ================================================= */}

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
            {previewItems.map((item, index) => (
              <div
                key={item.url}
                style={{
                  width: "80px",

                  height: "80px",

                  overflow: "hidden",

                  borderRadius: "8px",

                  position: "relative",
                }}
              >
                <img
                  src={item.url}
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
            onKeyDown={(event) => {
              // Prevent the parent
              // uploader from opening
              // the file picker.
              event.stopPropagation();
            }}
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

      {/* =================================================
          ERROR
          ================================================= */}

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

      {/* =================================================
          HIDDEN INPUT
          ================================================= */}

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

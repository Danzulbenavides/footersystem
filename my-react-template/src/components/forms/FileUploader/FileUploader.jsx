import React, { useState, useRef } from "react";
import styles from "./FileUploader.module.css";

const FileUploader = ({ onFilesSelected, allowMultiple = false }) => {
  const hiddenFileInput = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    // Convert the FileList object into a standard array
    const files = Array.from(event.target.files);
    validateAndSetFiles(files);
  };

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    setError(null);

    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const files = Array.from(event.dataTransfer.files);
      validateAndSetFiles(files);
    }
  };

  const validateAndSetFiles = (files) => {
    // Filter out anything that isn't an image
    const validImages = files.filter((file) => file.type.startsWith("image/"));

    if (validImages.length === 0) {
      setError("Please upload valid image files.");
      return;
    }

    // If multiple uploads aren't allowed, restrict to just the first valid image
    const finalFiles = allowMultiple ? validImages : [validImages[0]];

    setError(null);
    setSelectedFiles(finalFiles);

    // Send the array of files back to App.jsx
    if (onFilesSelected) {
      onFilesSelected(finalFiles);
    }
  };

  return (
    <div
      className={styles.dropzone}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => hiddenFileInput.current.click()}
      style={{
        backgroundColor: dragActive ? "#e0f2fe" : "transparent",
        border: "2px dashed #ccc",
        padding: "2rem",
        borderRadius: "8px",
        textAlign: "center",
        cursor: "pointer",
      }}
    >
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
            {selectedFiles.map((file, index) => (
              <img
                key={index}
                src={URL.createObjectURL(file)}
                alt={`Preview ${index}`}
                style={{
                  width: "80px",
                  height: "80px",
                  objectFit: "cover",
                  borderRadius: "8px",
                }}
              />
            ))}
          </div>
          <p style={{ marginTop: "1rem" }}>
            {selectedFiles.length} file(s) selected
          </p>
        </div>
      ) : (
        <p>Drag and drop image(s) here or click to browse</p>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      <input
        accept="image/*"
        multiple={allowMultiple}
        onChange={handleFileChange}
        type="file"
        ref={hiddenFileInput}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default FileUploader;

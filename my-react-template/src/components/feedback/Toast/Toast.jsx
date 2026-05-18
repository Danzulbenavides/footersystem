import React, { useEffect } from "react";
import styles from "./Toast.module.css";

const Toast = ({
  message,
  variant = "success",
  isVisible,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`${styles.toast} ${styles[variant]}`} role="alert">
      <span className={styles.message}>{message}</span>
      <button
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Close notifications"
      >
        {" "}
        &times;
      </button>
    </div>
  );
};

export default Toast;

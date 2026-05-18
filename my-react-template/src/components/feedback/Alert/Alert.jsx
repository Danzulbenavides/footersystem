import React from "react";
import styles from "./Alert.module.css";

const Alert = ({
  variant = "info", // "info", "success", "warning", or "error"
  children,
  onClose,
  className = "",
  ...restProps
}) => {
  const variantClass = styles[variant] || styles.info;

  const combinedClassName =
    `${styles.alert} ${variantClass} ${className}`.trim();

  return (
    <div className={combinedClassName} role="alert" {...restProps}>
      <div className={styles.content}>{children}</div>

      {onClose && (
        <button
          onClick={onClose}
          className={styles.closeButton}
          aria-label="Close Alert"
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default Alert;

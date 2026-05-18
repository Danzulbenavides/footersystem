import React from "react";
import styles from "./ProgressBar.module.css";

const ProgressBar = ({ progress = 0, label }) => {
  const safeProgress = Math.min(100, Math.max(0, progress));
  return (
    <div className={styles.container}>
      {label && (
        <div className={styles.labelWrapper}>
          <span>{label}</span>
          <span>{safeProgress}%</span>
        </div>
      )}

      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ width: `${safeProgress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;

import React from "react";
import styles from "./AspectRatioBox.module.css";

const AspectRatioBox = ({ ratio = "16/9", children, className = "" }) => {
  return (
    <div
      className={`${styles.container} ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <div className={styles.content}>{children}</div>
    </div>
  );
};

export default AspectRatioBox;

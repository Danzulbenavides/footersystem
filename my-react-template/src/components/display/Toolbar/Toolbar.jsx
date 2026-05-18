import React from "react";
import styles from "./Toolbar.module.css";

const Toolbar = ({ children, className = "", ...props }) => {
  return (
    <div className={`${styles.toolbar} ${className}`} role="toolbar" {...props}>
      {children}
    </div>
  );
};
export default Toolbar;

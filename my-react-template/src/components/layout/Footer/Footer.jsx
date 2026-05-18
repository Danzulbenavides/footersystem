import React from "react";
import styles from "./Footer.module.css";

const Footer = ({
  copyright,
  children,
  className = "",
  style = {},
  ...restProps
}) => {
  const combinedClassName = `${styles.footer} ${className}`.trim();

  const currentYear = new Date().getFullYear();

  return (
    <footer className={combinedClassName} style={style} {...restProps}>
      {children && <div className={styles.content}>{children}</div>}

      {copyright && (
        <p className={styles.copyright}>
          &copy; {currentYear} {copyright}. All rights reserved.
        </p>
      )}
    </footer>
  );
};
export default Footer;

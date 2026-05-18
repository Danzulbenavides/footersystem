import React from "react";
import styles from "./Header.module.css";

const Header = ({
  title,
  children,
  className = "",
  style = {},
  ...restProps
}) => {
  const combinedClassName = `${styles.header} ${className}`.trim();

  return (
    <header className={combinedClassName} style={style} {...restProps}>
      {title && <h1 className={styles.title}>{title}</h1>}

      {children && <div className={styles.childrenContainer}>{children}</div>}
    </header>
  );
};

export default Header;

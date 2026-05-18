import React from "react";
import styles from "./Navbar.module.css";

const NavBar = ({ links = [], className = "", style = {}, ...restProps }) => {
  const combinedClassName = `${styles.navbar} ${className}`.trim();

  return (
    <nav className={combinedClassName} style={style} {...restProps}>
      {links.map((link, index) => (
        <a key={index} href={link.href} className={styles.link}>
          {link.label}
        </a>
      ))}
    </nav>
  );
};

export default NavBar;

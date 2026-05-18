import React from "react";
import styles from "./Cards.module.css";

const Cards = ({
  image,
  title,
  description,
  children,
  className = "",
  style = {},
  ...restProps
}) => {
  const combinedClassName = `${styles.card} ${className}`.trim();

  return (
    <div className={combinedClassName} style={style} {...restProps}>
      {image && <img src={image} alt={title} className={styles.image} />}

      <div className={styles.content}>
        {title && <h3 className={styles.title}>{title}</h3>}
        {description && <p className={styles.description}>{description}</p>}

        {children && <div className={styles.footer}>{children}</div>}
      </div>
    </div>
  );
};

export default Cards;

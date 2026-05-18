import React, { useId } from "react";
import styles from "./Toggle.module.css";

const Toggle = ({
  label,
  checked,
  onChange,
  disabled = false,
  className = "",
  ...restProps
}) => {
  const id = useId();
  const combinedClassName = `${styles.wrapper} ${className}`.trim();

  return (
    <div className={combinedClassName}>
      <label
        htmlFor={id}
        className={`${styles.toggleLabel} ${disabled ? styles.disabled : ""}`}
      >
        <div className={styles.toggleControl}>
          <input
            type="checkbox"
            id={id}
            className={styles.invisibleInput}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            {...restProps}
          />
          <div className={styles.track}>
            <div className={styles.thumb}></div>
          </div>
        </div>

        {label && <span className={styles.labelText}>{label}</span>}
      </label>
    </div>
  );
};

export default Toggle;

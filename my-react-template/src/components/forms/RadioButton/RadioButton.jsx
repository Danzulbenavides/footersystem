import React from "react";
import styles from "./RadioButton.module.css";

const RadioButton = ({ label, name, value, checked, onChange, disabled }) => {
  return (
    <label
      className={`${styles.radioLabel} ${disabled ? styles.disabled : ""}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={styles.hiddenRadio}
      />
      <span className={styles.customRadio}></span>
      <span className={styles.labelText}>{label}</span>
    </label>
  );
};

export default RadioButton;

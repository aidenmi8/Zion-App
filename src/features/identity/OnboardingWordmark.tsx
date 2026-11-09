import styles from "./IdentitySetup.module.css";

/** Approved Zion artwork; the square geometry stays static and theme-independent. */
export function OnboardingWordmark() {
  return (
    <span className={styles.logoLayers}>
      <svg viewBox="0 0 64 64" role="img" aria-label="Zion">
        <defs>
          <linearGradient id="zion-silver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F5F5F7" />
            <stop offset="0.55" stopColor="#A6A6A8" />
            <stop offset="1" stopColor="#68686B" />
          </linearGradient>
        </defs>
        <path d="M16 30 32 12h20L36 30H16Z" fill="url(#zion-silver)" />
        <path d="M12 52 28 34h20L32 52H12Z" fill="url(#zion-silver)" />
      </svg>
      <span className={styles.brandWordmark} aria-hidden="true">
        Zion
      </span>
    </span>
  );
}

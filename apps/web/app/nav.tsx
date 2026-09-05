import Link from "next/link";
import styles from "./nav.module.css";

/**
 * Top-level navigation. The shell only — there are no authenticated routes
 * (spec §3 rules out user accounts, D-01), so every link here is public.
 */
export function Nav() {
  return (
    <nav className={styles.nav}>
      <Link href="/" className={styles.brand}>
        <span className={styles.mark} aria-hidden>
          R
        </span>
        repo-onboarding-copilot
      </Link>
      <div className={styles.links}>
        <a
          href="https://github.com/Suharshit/oss-repo-copilot"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}

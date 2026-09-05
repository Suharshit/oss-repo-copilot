import { Button } from "@repo/shared/ui/button";
import styles from "./page.module.css";

/**
 * Landing page shell: nav, headline, and the single repo-URL input the product
 * is built around. Submitting does nothing yet — wiring it to POST /v1/overview
 * is US-1, not part of the scaffold.
 */
export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>
          Go from &ldquo;I found this repo&rdquo; to a shipped PR
        </h1>
        <p className={styles.subtitle}>
          Paste a public GitHub repository and get an overview of what it does,
          a ranked list of approachable open issues, and a brief telling you
          which files to touch.
        </p>

        <form className={styles.form}>
          <input
            className={styles.input}
            type="url"
            name="repoUrl"
            placeholder="https://github.com/owner/name"
            aria-label="GitHub repository URL"
          />
          <Button type="submit" disabled>
            Analyze
          </Button>
        </form>

        <p className={styles.note}>Not wired up yet — this is the UI shell.</p>
      </main>
    </div>
  );
}

import { RepoUrlForm } from "../components/repo-url-form/repo-url-form";
import styles from "./page.module.css";

/** Landing page: one repo-URL input. Submitting opens the repo's own page (US-1). */
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

        <RepoUrlForm />
      </main>
    </div>
  );
}

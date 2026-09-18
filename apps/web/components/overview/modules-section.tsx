import type { Repo, RepoModule } from "@repo/shared/types";
import { repoUrl } from "@repo/shared/utils";
import { Section } from "../common/section";
import emptyStyles from "./empty.module.css";
import styles from "./modules-section.module.css";

interface ModulesSectionProps {
  repo: Repo;
  modules: RepoModule[];
}

export function ModulesSection({ repo, modules }: ModulesSectionProps) {
  return (
    <Section
      title="Main modules"
      actions={
        modules.length > 0 && (
          <span className={styles.count}>{modules.length}</span>
        )
      }
    >
      {modules.length > 0 ? (
        <ul className={styles.list}>
          {modules.map((module) => (
            <li key={module.path} className={styles.item}>
              {/* The API drops paths that aren't in the real tree, so these links resolve. */}
              <a
                className={styles.path}
                href={`${repoUrl(repo)}/tree/${repo.defaultBranch}/${module.path}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <code>{module.path}</code>
              </a>
              <p className={styles.description}>{module.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={emptyStyles.empty}>No main modules were identified.</p>
      )}
    </Section>
  );
}

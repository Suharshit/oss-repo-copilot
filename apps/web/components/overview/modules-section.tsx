import type { Repo, RepoModule } from "@repo/shared/types";
import { repoUrl } from "@repo/shared/utils";
import { Section } from "../common/section";

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
          <span className="text-[0.8125rem] text-muted">{modules.length}</span>
        )
      }
    >
      {modules.length > 0 ? (
        <ul className="flex flex-col">
          {modules.map((module) => (
            <li
              key={module.path}
              className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0"
            >
              {/* The API drops paths that aren't in the real tree, so these links resolve. */}
              <a
                className="w-fit text-sm wrap-anywhere hover:underline"
                href={`${repoUrl(repo)}/tree/${repo.defaultBranch}/${module.path}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <code>{module.path}</code>
              </a>
              <p className="text-[0.9375rem]/[1.55] text-muted">
                {module.description}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No main modules were identified.</p>
      )}
    </Section>
  );
}

import type { RelevantFile, Repo } from "@repo/shared/types";
import { repoUrl } from "@repo/shared/utils";
import { Section } from "../common/section";

interface RelevantFilesSectionProps {
  repo: Repo;
  files: RelevantFile[];
}

/** Where to start reading, most likely first (US-3). */
export function RelevantFilesSection({
  repo,
  files,
}: RelevantFilesSectionProps) {
  return (
    <Section
      title="Files to look at"
      actions={
        files.length > 0 && (
          <span className="text-[0.8125rem] text-muted-foreground">
            {files.length}
          </span>
        )
      }
    >
      {files.length > 0 ? (
        <ol className="flex flex-col">
          {files.map((file) => (
            <li
              key={file.path}
              className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0"
            >
              {/* The API drops paths that aren't in the real tree, so these
                  links resolve. GitHub redirects /blob/ to /tree/ for a directory. */}
              <a
                className="w-fit text-sm wrap-anywhere hover:underline"
                href={`${repoUrl(repo)}/blob/${repo.defaultBranch}/${file.path}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <code>{file.path}</code>
              </a>
              <p className="text-[0.9375rem]/[1.55] text-muted-foreground">
                {file.reason}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        // Every path the model suggested was dropped as invented, or the
        // issue didn't say enough to point at any.
        <p className="text-sm text-muted-foreground">
          The issue doesn&rsquo;t say enough to point at specific files. The
          suggested approach below explains what to look for instead.
        </p>
      )}
    </Section>
  );
}

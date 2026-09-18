import type { RepoConventions } from "@repo/shared/types";
import { Section } from "../common/section";

interface ConventionsSectionProps {
  /** null when the repo has no contributing docs to extract from. */
  conventions: RepoConventions | null;
}

const FIELDS: { key: keyof RepoConventions; label: string }[] = [
  { key: "branchNaming", label: "Branch naming" },
  { key: "testRequirements", label: "Tests" },
  { key: "lintRules", label: "Linting & formatting" },
  { key: "prTemplate", label: "Pull requests" },
];

/** US-4. Each field can be null, and null fields are hidden, not shown as "unknown". */
export function ConventionsSection({ conventions }: ConventionsSectionProps) {
  const rows = conventions
    ? FIELDS.flatMap(({ key, label }) => {
        const value = conventions[key];
        return typeof value === "string" && value.trim()
          ? [{ key, label, value }]
          : [];
      })
    : [];

  return (
    <Section title="Contribution conventions">
      {rows.length > 0 ? (
        <dl className="flex flex-col gap-4">
          {rows.map(({ key, label, value }) => (
            <div key={key} className="flex flex-col gap-1">
              <dt className="text-sm font-semibold">{label}</dt>
              <dd className="text-[0.9375rem]/[1.55] whitespace-pre-line text-muted">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted">
          This repo doesn&rsquo;t document contribution rules in a
          CONTRIBUTING.md or similar file.
        </p>
      )}

      {conventions && conventions.sources.length > 0 && (
        <p className="text-[0.8125rem] text-muted">
          From{" "}
          {conventions.sources.map((source, index) => (
            <span key={source}>
              {index > 0 && ", "}
              <code>{source}</code>
            </span>
          ))}
        </p>
      )}
    </Section>
  );
}

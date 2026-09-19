import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefView } from "../../../../../../components/brief/brief-view";
import {
  parseIssueNumber,
  parseRepoParams,
  repoPagePath,
} from "../../../../../../lib/routes";

/**
 * An issue's page, /r/[owner]/[name]/issues/[number], showing its contribution
 * brief (US-3). Rows in the issue list link here, and so does an issue URL
 * pasted on the landing page.
 */
export default async function IssuePage({
  params,
}: PageProps<"/r/[owner]/[name]/issues/[number]">) {
  const { owner, name, number: rawNumber } = await params;
  const ref = parseRepoParams({ owner, name });
  const number = parseIssueNumber(rawNumber);
  if (!ref || number === null) notFound();

  return (
    <div className="flex justify-center px-4 pt-10 pb-16">
      <main className="flex w-full max-w-208 flex-col gap-6">
        <Link
          href={repoPagePath(ref, "issues")}
          className="w-fit text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          ← All issues
        </Link>

        {/* Keyed so moving between issues starts from a clean loading state. */}
        <BriefView
          key={`${ref.owner}/${ref.name}#${number}`}
          issueRef={{ ...ref, number }}
        />
      </main>
    </div>
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/r/[owner]/[name]/issues/[number]">): Promise<Metadata> {
  const { owner, name, number: rawNumber } = await params;
  const ref = parseRepoParams({ owner, name });
  const number = parseIssueNumber(rawNumber);
  if (!ref || number === null) return {};

  return {
    title: `#${number} · ${ref.owner}/${ref.name} · repo-onboarding-copilot`,
    description: `Which files to look at and how to approach issue #${number} in ${ref.owner}/${ref.name}.`,
  };
}

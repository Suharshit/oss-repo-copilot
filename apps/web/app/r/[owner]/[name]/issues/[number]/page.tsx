import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { issueUrl } from "@repo/shared/utils";
import { Section } from "../../../../../../components/common/section";
import { RepoHeader } from "../../../../../../components/repo/repo-header";
import {
  parseIssueNumber,
  parseRepoParams,
  repoPagePath,
} from "../../../../../../lib/routes";

/**
 * An issue's page, /r/[owner]/[name]/issues/[number]. Rows in the issue list
 * link here. For now it's a placeholder; the contribution brief (US-3) will
 * render here next.
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

        <RepoHeader repo={ref} />

        <Section title={`Issue #${number}`}>
          <p className="text-[0.9375rem]/[1.55] text-muted-foreground">
            Contribution briefs are on the way. Soon this page will show the
            files to look at and a suggested approach for this issue.
          </p>
          <a
            className="w-fit text-sm hover:underline"
            href={issueUrl({ ...ref, number })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read #{number} on GitHub ↗
          </a>
        </Section>
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
  };
}

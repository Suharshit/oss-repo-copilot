import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { RepoRef } from "@repo/shared/types";
import { parseRepoUrl } from "@repo/shared/utils";
import { RepoOverview } from "../../../../components/overview/repo-overview";
import styles from "./page.module.css";

/**
 * A repo's own page, /r/[owner]/[name]. Its URL is the stable link a README
 * badge will point at (US-5); the issue list (US-2) joins the overview here.
 */
export default async function RepoPage({
  params,
}: PageProps<"/r/[owner]/[name]">) {
  const ref = parseRef(await params);
  if (!ref) notFound();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* Keyed so moving between repos starts from a clean loading state. */}
        <RepoOverview key={`${ref.owner}/${ref.name}`} repoRef={ref} />
      </main>
    </div>
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/r/[owner]/[name]">): Promise<Metadata> {
  const ref = parseRef(await params);
  if (!ref) return {};

  return {
    title: `${ref.owner}/${ref.name} · repo-onboarding-copilot`,
    description: `Overview, tech stack and contribution conventions for ${ref.owner}/${ref.name}.`,
  };
}

/** Params come straight from the address bar, so validate them the way a pasted URL is. */
function parseRef({
  owner,
  name,
}: {
  owner: string;
  name: string;
}): RepoRef | null {
  return parseRepoUrl(`github.com/${owner}/${name}`);
}

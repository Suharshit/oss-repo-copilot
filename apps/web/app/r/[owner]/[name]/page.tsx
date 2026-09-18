import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepoView } from "../../../../components/repo/repo-view";
import { parseRepoParams, parseRepoTab } from "../../../../lib/routes";

/**
 * A repo's own page, /r/[owner]/[name]. Its URL is the stable link a README
 * badge will point at (US-5). The overview (US-1) and the ranked issue list
 * (US-2) are its two tabs; `?tab=issues` opens the second.
 */
export default async function RepoPage({
  params,
  searchParams,
}: PageProps<"/r/[owner]/[name]">) {
  const ref = parseRepoParams(await params);
  if (!ref) notFound();
  const initialTab = parseRepoTab((await searchParams).tab);

  return (
    <div className="flex justify-center px-4 pt-10 pb-16">
      <main className="w-full max-w-208">
        {/* Keyed so moving between repos starts from a clean loading state. */}
        <RepoView
          key={`${ref.owner}/${ref.name}`}
          repoRef={ref}
          initialTab={initialTab}
        />
      </main>
    </div>
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/r/[owner]/[name]">): Promise<Metadata> {
  const ref = parseRepoParams(await params);
  if (!ref) return {};

  return {
    title: `${ref.owner}/${ref.name} · repo-onboarding-copilot`,
    description: `Overview, tech stack, contribution conventions and good first issues for ${ref.owner}/${ref.name}.`,
  };
}

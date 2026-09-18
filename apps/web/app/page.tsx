import { RepoUrlForm } from "../components/repo-url-form/repo-url-form";

/** Landing page: one repo-URL input. Submitting opens the repo's own page (US-1). */
export default function Home() {
  return (
    <div className="flex flex-col items-center px-6 pt-24 pb-16">
      <main className="flex w-full max-w-160 flex-col gap-6 text-center">
        <h1 className="text-[clamp(1.75rem,5vw,2.5rem)] leading-[1.15] font-bold tracking-[-0.02em]">
          Go from &ldquo;I found this repo&rdquo; to a shipped PR
        </h1>
        <p className="leading-[1.6] text-muted-foreground">
          Paste a public GitHub repository and get an overview of what it does,
          a ranked list of approachable open issues, and a brief telling you
          which files to touch.
        </p>

        <RepoUrlForm />
      </main>
    </div>
  );
}

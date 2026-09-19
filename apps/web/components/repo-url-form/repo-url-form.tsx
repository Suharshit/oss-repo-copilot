"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { parseGithubUrl } from "@repo/shared/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { issuePagePath, repoPagePath } from "../../lib/routes";

const INVALID_URL_MESSAGE =
  "Paste a public GitHub repo or issue URL, e.g. https://github.com/owner/repo.";

const PULL_REQUEST_MESSAGE =
  "That's a pull request, and briefs are for issues. Paste an issue URL, or the repo URL to browse its issues.";

/**
 * The landing page's one input, taking a repo URL (US-1) or an issue URL
 * (US-3). It only validates and navigates; the page it opens does the
 * fetching, so the result can be shared or bookmarked (US-5).
 */
export function RepoUrlForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Built on the same parsers the API uses, so a URL rejected here would
    // have been rejected there too, and we skip a wasted round trip.
    const target = parseGithubUrl(value);
    if (!target) {
      setError(INVALID_URL_MESSAGE);
      return;
    }
    // Caught here rather than on the issue page: the API would only say so
    // after a request against the caller's generation limit.
    if (target.kind === "pull") {
      setError(PULL_REQUEST_MESSAGE);
      return;
    }
    setError(null);
    setNavigating(true);
    router.push(
      target.kind === "issue"
        ? issuePagePath(target.ref, target.ref.number)
        : repoPagePath(target.ref),
    );
  }

  const isIssue = parseGithubUrl(value)?.kind === "issue";

  return (
    <form
      className="mt-2 flex flex-col gap-2 text-left"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="flex gap-2 max-[30rem]:flex-col">
        {/* type="text", not "url": the browser's url check rejects
            "github.com/owner/name", which parseGithubUrl accepts. */}
        <Input
          className="h-11 flex-1 bg-background px-3.5 md:text-base"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          name="repoUrl"
          placeholder="https://github.com/owner/name"
          aria-label="GitHub repository or issue URL"
          aria-invalid={error !== null}
          aria-describedby={error ? "repo-url-error" : undefined}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
        />
        <Button
          type="submit"
          size="lg"
          className="h-11 px-5 text-base"
          disabled={!value.trim() || navigating}
        >
          {navigating
            ? "Opening…"
            : isIssue
              ? "Get brief"
              : "Generate overview"}
        </Button>
      </div>
      {error && (
        <p
          id="repo-url-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </form>
  );
}

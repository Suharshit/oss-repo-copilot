"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@repo/shared/ui/button";
import { parseRepoUrl } from "@repo/shared/utils";
import { repoPagePath } from "../../lib/routes";

const INVALID_URL_MESSAGE =
  "Paste a public GitHub repo URL, e.g. https://github.com/owner/repo.";

/**
 * The landing page's one input. It only validates and navigates; the repo page
 * does the fetching, so a repo URL can be shared or bookmarked (US-5).
 */
export function RepoUrlForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Parsed with the same function the API uses, so a URL rejected here would
    // have been rejected there too, and we skip a wasted round trip.
    const ref = parseRepoUrl(value);
    if (!ref) {
      setError(INVALID_URL_MESSAGE);
      return;
    }
    setError(null);
    setNavigating(true);
    router.push(repoPagePath(ref));
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2 text-left"
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="flex gap-2 max-[30rem]:flex-col">
        {/* type="text", not "url": the browser's url check rejects
            "github.com/owner/name", which parseRepoUrl accepts. */}
        <input
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3.5 py-3 text-foreground focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-foreground aria-invalid:border-danger"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          name="repoUrl"
          placeholder="https://github.com/owner/name"
          aria-label="GitHub repository URL"
          aria-invalid={error !== null}
          aria-describedby={error ? "repo-url-error" : undefined}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
        />
        <Button type="submit" disabled={!value.trim() || navigating}>
          {navigating ? "Opening…" : "Generate overview"}
        </Button>
      </div>
      {error && (
        <p id="repo-url-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

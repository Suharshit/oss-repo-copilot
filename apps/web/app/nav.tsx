import Link from "next/link";

/**
 * Top-level navigation. The shell only — there are no authenticated routes
 * (spec §3 rules out user accounts, D-01), so every link here is public.
 */
export function Nav() {
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
      <Link
        href="/"
        className="flex items-center gap-2.5 font-semibold tracking-[-0.01em]"
      >
        {/* Logo placeholder — a real mark replaces this later. */}
        <span
          className="grid size-7 place-items-center rounded-lg bg-foreground text-sm font-bold text-background"
          aria-hidden
        >
          R
        </span>
        repo-onboarding-copilot
      </Link>
      <div className="flex gap-5 text-sm text-muted">
        <a
          href="https://github.com/Suharshit/oss-repo-copilot"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground"
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}

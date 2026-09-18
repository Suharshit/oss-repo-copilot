interface TagListProps {
  tags: string[];
  /** Accessible name for the list, e.g. "Tech stack" or "Issue labels". */
  label: string;
  className?: string;
}

/** A wrapping row of pill tags. Used for tech stack and issue labels. */
export function TagList({ tags, label, className }: TagListProps) {
  if (tags.length === 0) return null;

  return (
    <ul
      className={["flex flex-wrap gap-2", className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded-full border border-border px-2.5 py-1 text-[0.8125rem]/[1.4]"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}

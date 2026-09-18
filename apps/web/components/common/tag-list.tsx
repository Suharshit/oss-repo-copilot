import styles from "./tag-list.module.css";

interface TagListProps {
  tags: string[];
  /** Accessible name for the list, e.g. "Tech stack" or "Issue labels". */
  label: string;
  className?: string;
}

/** A wrapping row of pill tags. Used for tech stack now, issue labels later. */
export function TagList({ tags, label, className }: TagListProps) {
  if (tags.length === 0) return null;

  return (
    <ul
      className={[styles.list, className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {tags.map((tag) => (
        <li key={tag} className={styles.tag}>
          {tag}
        </li>
      ))}
    </ul>
  );
}

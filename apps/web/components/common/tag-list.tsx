import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label={label}>
      {tags.map((tag) => (
        <li key={tag}>
          <Badge variant="outline" className="font-normal">
            {tag}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

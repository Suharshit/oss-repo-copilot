import { Section } from "../common/section";
import { TagList } from "../common/tag-list";

interface TechStackSectionProps {
  techStack: string[];
}

export function TechStackSection({ techStack }: TechStackSectionProps) {
  return (
    <Section title="Tech stack">
      {techStack.length > 0 ? (
        <TagList tags={techStack} label="Tech stack" />
      ) : (
        <p className="text-sm text-muted-foreground">
          No tech stack could be identified.
        </p>
      )}
    </Section>
  );
}

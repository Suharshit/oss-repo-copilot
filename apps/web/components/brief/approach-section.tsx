import { Section } from "../common/section";

interface ApproachSectionProps {
  approach: string;
}

export function ApproachSection({ approach }: ApproachSectionProps) {
  return (
    <Section title="Suggested approach">
      {/* pre-line keeps the model's step breaks without rendering markdown. */}
      <p className="leading-[1.65] whitespace-pre-line">{approach}</p>
    </Section>
  );
}

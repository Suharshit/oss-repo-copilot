import { Section } from "../common/section";

interface SummarySectionProps {
  summary: string;
}

export function SummarySection({ summary }: SummarySectionProps) {
  return (
    <Section title="What this repo does">
      {/* pre-line keeps the model's paragraph breaks without rendering markdown. */}
      <p className="leading-[1.65] whitespace-pre-line">{summary}</p>
    </Section>
  );
}

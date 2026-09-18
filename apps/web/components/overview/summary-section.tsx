import { Section } from "../common/section";
import styles from "./summary-section.module.css";

interface SummarySectionProps {
  summary: string;
}

export function SummarySection({ summary }: SummarySectionProps) {
  return (
    <Section title="What this repo does">
      <p className={styles.summary}>{summary}</p>
    </Section>
  );
}

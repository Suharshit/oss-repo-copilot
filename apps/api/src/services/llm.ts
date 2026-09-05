import type {
  ContributionBrief,
  Issue,
  Repo,
  RepoOverview,
} from "@repo/shared/types";
import { HttpError } from "../lib/errors.js";

/**
 * Generation boundary. Both calls are stubbed for now — the routes, types and
 * caching contract around them are real, so wiring the Anthropic API in here
 * is a self-contained change.
 */
export interface GenerationService {
  generateOverview(input: OverviewInput): Promise<RepoOverview>;
  generateBrief(input: BriefInput): Promise<ContributionBrief>;
}

export interface OverviewInput {
  repo: Repo;
  /** Paths from the repo file tree — no AST parsing in v1 (spec §6). */
  fileTree: string[];
  readme: string | null;
  manifests: Record<string, string>;
}

export interface BriefInput {
  repo: Repo;
  issue: Issue;
  fileTree: string[];
  contributing: string | null;
}

export const generationService: GenerationService = {
  async generateOverview() {
    throw new HttpError(
      "internal_error",
      "Overview generation is not wired up yet (see apps/api/src/services/llm.ts).",
    );
  },

  async generateBrief() {
    throw new HttpError(
      "internal_error",
      "Brief generation is not wired up yet (see apps/api/src/services/llm.ts).",
    );
  },
};

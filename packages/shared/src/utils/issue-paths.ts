/**
 * Orders a file tree so the paths an issue most likely touches come first.
 *
 * The brief prompt only has room for part of a large tree, and GitHub returns
 * it in sort order, so without this the model sees whatever sorts first — in a
 * big repo that is rarely the file the issue is about, and it cannot cite a
 * path it was never shown. This is plain word overlap, not search: cheap,
 * deterministic, and enough to pull `src/request.ts` forward for an issue
 * about `c.req.formData()`.
 *
 * Scoring, per path:
 * - the issue names the path, or its filename, outright: MENTION_SCORE
 * - each distinct issue word that is the filename's stem or a word in it: 2
 * - each distinct issue word that is a directory name: 1
 *
 * A word matching more than COMMON_TERM_SHARE of the tree scores nothing: it
 * is usually the project's own name ("vscode" against every `vscode-node/`
 * directory), and ranking on it only buries the paths that matched something
 * specific.
 *
 * The sort is stable, so paths with no match keep GitHub's order behind the
 * ones that matched.
 */
export function rankPathsForIssue(
  paths: string[],
  issueText: string,
): string[] {
  const text = issueText.toLowerCase();
  const terms = new Set(words(issueText));
  if (terms.size === 0) return paths;

  const matches = paths.map((path) => matchPath(path, text, terms));

  const pathsPerTerm = new Map<string, number>();
  for (const { fileTerms, dirTerms } of matches) {
    for (const term of [...fileTerms, ...dirTerms]) {
      pathsPerTerm.set(term, (pathsPerTerm.get(term) ?? 0) + 1);
    }
  }
  // The floor keeps a small tree from treating every match as common.
  const commonAt = Math.max(
    COMMON_TERM_FLOOR,
    paths.length * COMMON_TERM_SHARE,
  );
  const specific = (term: string) => (pathsPerTerm.get(term) ?? 0) <= commonAt;

  const scored = matches.map((match, index) => ({
    path: paths[index] as string,
    index,
    score: match.mentioned
      ? MENTION_SCORE
      : 2 * match.fileTerms.filter(specific).length +
        match.dirTerms.filter(specific).length,
  }));

  // Nothing matched: hand the tree back untouched rather than a copy.
  if (scored.every(({ score }) => score === 0)) return paths;

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ path }) => path);
}

/** Outweighs any amount of word overlap: the reporter named the file. */
const MENTION_SCORE = 100;

/** Share of the tree above which a matching word stops counting. */
const COMMON_TERM_SHARE = 0.1;
const COMMON_TERM_FLOOR = 20;

interface PathMatch {
  mentioned: boolean;
  /** Issue words found in the filename. */
  fileTerms: string[];
  /** Issue words found only in the directories. */
  dirTerms: string[];
}

function matchPath(path: string, text: string, terms: Set<string>): PathMatch {
  const lowerPath = path.toLowerCase();
  const slash = lowerPath.lastIndexOf("/");
  const filename = lowerPath.slice(slash + 1);

  // Filenames shorter than this ("a.js", "io.go") appear inside ordinary words
  // too often to count as a mention.
  const mentioned =
    text.includes(lowerPath) ||
    (filename.length >= 6 && filename.includes(".") && text.includes(filename));

  const fileWords = new Set(words(path.slice(slash + 1)));
  const dirWords = new Set(words(path.slice(0, Math.max(slash, 0))));

  const fileTerms: string[] = [];
  const dirTerms: string[] = [];
  for (const term of terms) {
    if (fileWords.has(term)) fileTerms.push(term);
    else if (dirWords.has(term)) dirTerms.push(term);
  }
  return { mentioned, fileTerms, dirTerms };
}

/**
 * Lowercase words of three letters or more, split on punctuation and on
 * camelCase, with a trailing plural "s" dropped so `hooks` meets `hook`.
 * Exported for tests.
 */
export function words(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) =>
      word.length > 4 && word.endsWith("s") && !word.endsWith("ss")
        ? word.slice(0, -1)
        : word,
    )
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

/**
 * English filler plus words that turn up in most issues and most trees alike,
 * so matching on them ranks nothing. File extensions are here because a
 * mention of "a .ts file" says nothing about which one.
 */
// prettier-ignore
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "not",
  "but", "are", "was", "were", "been", "when", "then", "than", "there", "what",
  "which", "who", "how", "why", "can", "could", "should", "would", "will",
  "does", "doesn", "don", "didn", "isn", "its", "into", "also", "just", "only",
  "some", "any", "all", "more", "most", "other", "such", "same", "very", "like",
  "about", "after", "before", "because", "while", "where", "these", "those",
  "you", "your", "our", "they", "them", "their", "his", "her", "one", "two",
  "use", "using", "used", "get", "set", "make", "need", "want", "see", "try",
  "issue", "bug", "error", "problem", "expected", "actual", "behavior",
  "behaviour", "reproduce", "reproduction", "steps", "version", "please",
  "thank", "thanks", "http", "https", "www", "com", "github",
  "src", "lib", "index", "main", "test", "tests", "spec", "file", "code",
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "md", "py", "rs", "go",
]);

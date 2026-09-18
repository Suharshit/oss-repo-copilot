# Suggested Order

1. Overview page: a repo URL input, then a loading state, then the summary, tech stack, modules and conventions, plus a "Regenerate" button that sends refresh: true. Give each repo its own page, such as /r/[owner]/[name]. That URL is what the README badge will link to later.
2. Issue list: add ranked issues to the same repo page, with each issue's score and labels.
3. Brief page: clicking an issue, or pasting an issue URL, shows the brief. This is where you settle whether the conventions belong in the brief.
4. Test with real repos. Tune the prompts and the issue scoring, and fix the backend gaps you find, like saving briefs and logging upstream errors.
5. README badge. It's quick once the repo pages exist.
6. Launch hardening: a least-privilege GitHub token, deleting expired cache rows, running tests in CI, monitoring, and a decision on where to deploy the API.

# Project Brief

> Source of truth for scope: [`spec.md`](../spec.md). This file is the condensed,
> always-in-context version. If the two disagree, `spec.md` wins.

## What this is

**repo-onboarding-copilot** helps a newcomer go from "I just found this repo" to
a shipped pull request.

Existing tools (DeepWiki, Greptile) explain code in general. None are built
around the specific job of _getting a first contribution out the door_. That job
is the entire product.

## The problem

New contributors to open-source projects lose momentum before their first PR.
Two things kill it:

1. They can't quickly understand an unfamiliar codebase.
2. Once they pick an issue, they can't tell what it actually requires.

## V1 goals

- Paste a **repo URL** → fast, useful overview of what it does and how it's organized.
- Surface **approachable open issues**, ranked by how first-timer friendly they look.
- Paste an **issue URL** → a contribution brief: relevant files, what likely needs
  to change, conventions to follow.
- Stay **cheap to run per repo**. This is a side project, not a funded product.

## Core user flows

| ID   | Flow                       | Ships as                          |
| ---- | -------------------------- | --------------------------------- |
| US-1 | Repo overview (cold start) | `POST /v1/overview`               |
| US-2 | Good-first-issue discovery | `GET /v1/issues`                  |
| US-3 | Contribution brief         | `POST /v1/brief`                  |
| US-4 | Repo conventions lookup    | folded into the overview response |
| US-5 | Maintainer README badge    | static, no backend work           |

## Explicit non-goals for V1

Cutting these is what keeps V1 shippable. Do not quietly reintroduce them.

- Private repos — public GitHub only.
- Writing code or opening PRs. The tool explains and points; it does not fix.
- Semantic code graph / call-graph / AST indexing.
- Multi-turn chat Q&A. Output is structured briefs, not a conversation.
- GitLab, Bitbucket, or any non-GitHub host.
- Maintainer dashboards, analytics, webhooks, re-indexing on commit.
- User accounts, saved history, personalization. The tool is stateless per visit.
- Non-English repos (best-effort only).
- Mobile app or browser extension. Web only.

## Shape of the product

Two apps and one shared package in a Turborepo:

- `apps/web` — Next.js frontend. Paste a URL, see a brief.
- `apps/api` — Hono service. Talks to GitHub + an LLM, caches what's expensive.
- `packages/shared` — the contract between them, plus UI.

See [`Architecture.md`](./Architecture.md).

## What "done" looks like for V1

A stranger pastes `https://github.com/owner/repo`, gets a readable overview and a
ranked issue list within a few seconds, clicks an issue, and gets a brief that
names real files in that repo. No login anywhere in that path.

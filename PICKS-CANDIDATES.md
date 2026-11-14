# Picks candidates (the page pass cuts each part to 4 to 6, then deletes this file)

How to read this. Each line has the author, the year, the kind, and why it passes the bar in STANDARD-v2
section 5: made by the person or team who runs the method, about the idea and not a launch, no listicle, no
paywall. Links are given for official pages only. None of these links was opened in this build session, so the
nightly link check and a person must confirm each link, and the video ones need the oEmbed check. Where I am
not sure of the exact title, the line says "find the talk". Aim for at least 2 videos in each final list.

## Part 00: meet the library

1. Anthropic, "Best practices for Claude Code", docs (code.claude.com/docs/en/best-practices). Official docs by the makers. Teaches plan first, give it a check, keep context clean. Evergreen.
2. Anthropic, "Common workflows", docs (code.claude.com/docs/en/common-workflows). Official docs. Shows `@` files, plan mode and images in real tasks.
3. Boris Cherny (creator of Claude Code), talk on how he uses Claude Code, 2025, video. Made by the person who built the tool. Find the talk at a major AI conference and confirm it is not a launch demo.
4. Anthropic, "Building effective agents", engineering blog, 2024. By the team that runs agents in production. About patterns, not a product.
5. Anthropic Applied AI team, "Effective harnesses for long-running agents", engineering blog, 2025. The makers describe the loop a factory is built from.
6. Simon Willison, "Designing agentic loops", blog, 2025. A long-time practitioner who writes his own experiments. Not a listicle.
7. Anthropic, "Claude Code overview and quickstart", docs. Official. Short, for the install and first prompt.
8. Anthropic, a Claude Code tour video on the official YouTube channel, 2025. Official channel. Confirm it is about the idea and not a release.

## Part 01: write the work order

1. Alistair Mavin and colleagues, "Easy Approach to Requirements Syntax (EARS)", conference paper, 2009. The original paper by the people who made the method. Evergreen. The spec step uses EARS lines.
2. Birgitta Boeckeler, "Understanding spec-driven development", martinfowler.com, 2025. A named engineer at a company that runs it, on a respected engineering site.
3. GitHub, "Spec Kit" repository and its spec-driven development guide, 2025. Made by the team that runs it. Confirm the page teaches the idea.
4. Anthropic, "Best practices for Claude Code", the sections on giving a goal and a way to check. Official docs.
5. GitHub Docs, "Syntax for issue forms", docs. Official docs for the issue form step.
6. Dex Horthy, "12-factor agents", repository and talk, 2025. By the practitioner who wrote it. Covers small focused agents and owning your prompts. Find the talk.
7. Anthropic, "Effective context engineering for AI agents", engineering blog, 2025. The makers on what to put in front of the model.
8. Kent Beck, writing on test-driven development with AI agents (his "augmented coding" posts), 2025. Made by the person who created the method. Confirm the exact post.
9. Anthropic, "Claude Code: common workflows", the plan-then-code section. Official docs. Short.

## Part 02: teach the repo

1. Anthropic, "How Claude remembers your project" (memory and CLAUDE.md), docs. Official docs on CLAUDE.md, imports and rules.
2. Anthropic, "Best practices for Claude Code", the CLAUDE.md section, docs. Official. Says to keep it short.
3. agents.md, "AGENTS.md: a README for agents", the site, 2025. The open format made by the group that uses it. Confirm it stays about the idea.
4. Anthropic, "Skills" docs and the "Equipping agents for the real world with Agent Skills" engineering post, 2025. By the team that made skills.
5. Anthropic, ".claude directory" and path-rule docs. Official docs for `.claude/rules` with `paths`.
6. Anthropic, "Effective context engineering for AI agents", 2025. The makers on why a long file hurts.
7. Boris Cherny, talk or thread on his own CLAUDE.md habits, 2025. The creator of the tool. Find the item and confirm.
8. Simon Willison, notes on using AGENTS.md and rules files, blog, 2025. Practitioner with his own repos. Find the post.
9. Hamel Husain, "Your AI product needs evals" or a post on reading traces, 2024. A practitioner who runs this work. Use only if the page pass wants an idea piece.

## Part 03: split the roles

1. Anthropic, "Subagents" docs (code.claude.com/docs/en/sub-agents). Official docs for the planner, builder and reviewer files.
2. Anthropic, "How we built our multi-agent research system", engineering blog, 2025. The team that runs it in production, with honest costs.
3. Anthropic, "Building effective agents", the orchestrator and evaluator parts, 2024. The makers. Evergreen.
4. Git, "git-worktree" manual and the Pro Git book chapter on it, Chacon and Straub. Made by the Git project and its book authors. Evergreen. For the isolate step.
5. Anthropic, "Common workflows", the worktree section. Official docs for `claude -w`.
6. Cognition, "Don't build multi-agents", blog, 2025. A team that runs a coding agent argues the other side. Good to show a tradeoff. Confirm tone.
7. Anthropic, "Demystifying evals for AI agents", engineering blog. By the team that grades agents. Confirm the title and year.
8. Anthropic Claude Code `/code-review` docs. Official. For the fresh-eyes reviewer.
9. A conference talk by a Claude Code team member on subagents, 2025, video. Find the talk and confirm it is about the idea.

## Part 04: gate the agent

1. Anthropic, "Hooks reference" and "Get started with hooks", docs. Official docs for PreToolUse and Stop hooks.
2. Anthropic, "Permissions" and "Settings" docs. Official docs for deny rules.
3. Anthropic, "Beyond permission prompts: making Claude Code more secure and autonomous", engineering blog, 2025. The team that built the sandbox explains why.
4. Anthropic, "Sandboxing" docs. Official.
5. GitHub Docs, "About rulesets" and "About code owners". Official docs for the branch step.
6. Simon Willison, "The lethal trifecta for AI agents", blog, 2025. A practitioner who named the idea. Evergreen.
7. OWASP, "Top 10 for LLM applications", the prompt injection and excessive agency entries, 2025. Made by the OWASP project. Not a listicle: it is the standard reference.
8. Anthropic, "Mitigating the risk of prompt injections in browser use", research post, 2025. The makers. Confirm title.
9. A talk by a Claude Code security or safety engineer on permissions and sandboxing, 2025, video. Find the talk.
10. Anthropic, "Claude Code security" docs page. Official.

## Part 05: run it unattended

1. Anthropic, "Run Claude Code programmatically" (headless, `claude -p`), docs. Official.
2. Anthropic, "Claude Code GitHub Actions" docs and the `claude-code-action` repository README. Official.
3. GitHub Docs, "Security hardening for GitHub Actions", the script injection section. Official docs. Directly about hostile issue text.
4. GitHub Docs, "Control the concurrency of workflows and jobs". Official.
5. GitHub Security Lab, "Keeping your GitHub Actions and workflows secure", blog series, 2021 onward. Made by the team that finds these bugs. Evergreen.
6. Anthropic, "Effective harnesses for long-running agents", 2025. The makers.
7. Anthropic, "Scheduled tasks" or routines docs for `/loop` and `/schedule`. Official. Confirm the page name.
8. Pro Git, "Rebasing", Chacon and Straub. For the conflict step. Evergreen.
9. Geoffrey Huntley, writing on running an agent in a loop, 2025. A practitioner who made the pattern popular. Confirm the post and tone.
10. A conference talk on running coding agents in CI, 2025, video. Find the talk.

## Part 06: price and ship

1. Anthropic, "Manage costs effectively" docs (code.claude.com/docs/en/costs). Official, already cited in the part.
2. Anthropic, "Monitoring usage" docs (OpenTelemetry settings for Claude Code). Official. For the telemetry rule.
3. OpenTelemetry project, "What is OpenTelemetry?" and the metrics concepts page. Made by the project. Evergreen.
4. Anthropic, "Harness design for long-running apps", engineering blog, 2025. Already cited in the part. Real cost numbers.
5. Anthropic, "Model configuration" docs for model aliases and roles. Official.
6. Google, "Site Reliability Engineering" book, the chapter on postmortems or on monitoring. Made by the team that runs the systems. Evergreen. For the retro.
7. Hamel Husain, "A field guide to improving AI products", blog, 2025. A practitioner who runs this work. Confirm it fits.
8. Anthropic, "Demystifying evals for AI agents". For before and after reruns. Confirm title and year.
9. Charity Majors, writing on measuring in production (observability), 2020 onward. A practitioner who built a company on it. Pick one post.
10. Boris Cherny or another Claude Code engineer on cost habits, talk, 2025, video. Find the talk.

## Part 07: track agent cost

1. LiteLLM, "Virtual keys" and "Budgets" docs. Official docs of the tool the step uses.
2. LiteLLM, "Claude Code quickstart with the proxy", docs. Official.
3. Anthropic, "LLM gateway configuration" docs for Claude Code. Official.
4. agentgateway project docs, introduction. Made by the project. Used in the choice note.
5. Anthropic, "Manage costs effectively", the team and gateway sections. Official.
6. OpenTelemetry, "Semantic conventions for generative AI", spec. Made by the standards group. Evergreen.
7. Simon Willison, notes on LLM proxies and budgets, blog. A practitioner. Find the post.
8. A talk from a platform team on running an LLM gateway in production, video. Find the talk and confirm it is not a vendor pitch.

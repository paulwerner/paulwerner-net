# Session 001 — Project Scaffolding

## Outcome

Repo scaffolding complete. Nine session commits produced a skeleton three-service Docker Compose stack (Caddy + Ghost + MySQL), an environment-variable template, an updated CLAUDE.md reflecting Phase 1 decisions, and a minimal landing-page placeholder. Nothing runs yet — Phase 3 will bring the stack up.

## What was built

- [docs/plans/001-project-scaffolding.md](../plans/001-project-scaffolding.md) — plan persisted from the Claude Code plans directory
- [.gitignore](../../.gitignore) — populated (secrets, Node, build output, Docker artifacts, Ghost local dev content, OS files, editors, Claude Code local settings)
- [.env.example](../../.env.example) — template with every key needed by `docker-compose.yml`, grouped and inline-commented
- [docker-compose.yml](../../docker-compose.yml) — skeleton for `caddy`, `ghost`, `mysql` on a shared bridge network, named volumes, MySQL healthcheck, Ghost waiting on `service_healthy`
- [Caddyfile](../../Caddyfile) — skeleton with two site blocks wired to `{$DOMAIN}` and `{$BLOG_SUBDOMAIN}`
- [site/index.html](../../site/index.html) — minimal placeholder page
- [CLAUDE.md](../../CLAUDE.md) — rewritten: Caddy confirmed as reverse proxy, Hetzner CX23 recorded as hosting, directory tree aligned with current reality, new sections for Domain Mapping, Decisions (as a docs category), and Environment Variables
- [README.md](../../README.md) — architecture paragraph, Phase 1 run-locally note, links to CLAUDE.md and the hosting decision
- `docs/sessions/.gitkeep`, `docs/learnings/.gitkeep`, `docs/brand/legacy_reference.png` — directory scaffolding tracked

## Key decisions made during implementation

- **`install.cmd` deleted rather than gitignored.** It was a local Claude Code installer sitting untracked in the repo — not project content. Confirmed with the user before acting.
- **Landing-page directory named `site/`, not `landing-page/`.** The Session 001 prompt used `site/` explicitly, which contradicts the `./landing-page/` reference in the (immutable) hosting decision record. Prompt wins; decision record left unchanged. CLAUDE.md and the Caddy bind mount both use `site/`.
- **CLAUDE.md Directory Structure shows only what exists now.** Future directories (`ghost-theme/`, `scripts/`) are mentioned in a sentence below the tree but not included in the tree itself, so CLAUDE.md stays truthful as the repo grows.
- **`.claude/` added to `.gitignore`.** A `.claude/settings.local.json` file appeared during the session from the Claude Code harness — treated as local-environment noise, ignored alongside `.vscode/` and `.idea/`.
- **MySQL healthcheck included in the skeleton.** CLAUDE.md code-style rules call for healthchecks on Compose services; included early so Phase 3 starts from a compliant baseline.

## Commits

```
7198d5b docs: expand README
c7b6eda docs: update CLAUDE.md for Phase 1 decisions
9782e3a feat: add landing page placeholder
558b8ac feat: add Caddyfile skeleton
d218cb8 feat: add docker-compose skeleton
8f73e5f chore: scaffold docs/sessions, docs/learnings, and brand asset
640237e chore: add .env.example template
cee8050 chore: populate .gitignore and drop local installer
4b7eeb7 docs: add session 001 plan
```

One commit per task, per the CLAUDE.md session-lifecycle rule. An incidental upstream commit (`8a3756e add hosting decision`) from the owner landed between plan read and implementation start; no conflicts.

## What's next

- **Phase 2 — Brand & Design.** Establish brand guidelines (colour palette, typography, voice) in `docs/brand/`, evolved from `legacy_reference.png`.
- **Phase 3 — Stack finalisation.** Replace the skeleton docker-compose and Caddyfile with production-ready configs. First real `docker compose up` happens here — locally first, then on the Hetzner VPS.
- **Phase 4 — Ghost theme.** Scaffold `ghost-theme/` with Handlebars templates, code-block styling, and syntax highlighting.
- **Phase 5 — Operational polish.** Scripts in `scripts/` for deploy/backup, monitoring, and off-box backup destination.

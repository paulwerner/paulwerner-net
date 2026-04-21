# Phase 1: Hosting & Architecture Decision

**Status:** Decided — April 2026
**Phase:** Infrastructure Research

---

## Hosting Provider

**Hetzner Cloud** — selected as the primary hosting provider.

### Plan: CX23 (Shared Cost-Optimized)

| Spec | Value |
|------|-------|
| vCPU | 2 (Intel/AMD, shared) |
| RAM | 4 GB |
| Storage | 40 GB NVMe SSD |
| Traffic | 20 TB included (€1.19/TB overage within EU) |
| Location | NBG-1, Nuremberg, Germany |
| IPv4 | Primary IPv4 (required) |
| Billing | Hourly (€0.0086/hr), no commitment |

### Monthly Cost

| Line item | Cost |
|-----------|------|
| CX23 base | €4.75 |
| Primary IPv4 | €0.60 |
| Traffic (20 TB included) | €0.00 |
| **Total (incl. 19% VAT)** | **€5.34** |

Optional add-ons not yet committed:

| Add-on | Cost | Notes |
|--------|------|-------|
| Managed backups (7-slot daily) | ~€0.95/mo (+20% of instance) | Alternative: scripted backups to Storage Box |
| Hetzner Storage Box (1 TB) | €4.00/mo | For off-box backup storage if needed |
| Upgrade to CPX23 (AMD EPYC, 80 GB disk) | ~€8.59 total | If 40 GB disk becomes limiting |

### Why Hetzner

The decision was made after evaluating six EU-based VPS providers (Hetzner, Netcup, OVHcloud, Contabo, Hostinger, UpCloud/Scaleway) against these constraints:

- **EU data residency** (GDPR) — Hetzner's Nuremberg DC is in Germany.
- **Sub-€10/mo budget** — CX23 lands at €5.34/mo all-in.
- **Docker support** — KVM virtualization, Ubuntu 24.04 LTS, cloud-init, one-click Docker images.
- **No commitment required** — hourly billing, cancel anytime. Important for a project that's just starting.
- **Community ecosystem** — Hetzner is the most commonly used provider in the European self-hosting community, which means better documentation and fewer edge-case surprises.

### Alternatives considered

**Netcup VPS 500 G12** (€5.91/mo incl. VAT) was the runner-up — more hardware (128 GB NVMe, DDR5 ECC, unmetered traffic) but requires a 12-month contract and has a dated control panel with occasional cloud-init quirks.

**OVHcloud VPS-1** (€5.52/mo, annual) was the third option — includes free daily backups and offers more RAM (8 GB) and disk (75 GB), but the control panel is clunky and trust was affected by the 2021 Strasbourg DC fire.

**Contabo, Hostinger, Scaleway, and UpCloud** were ruled out for various reasons: I/O throttling and reputation concerns (Contabo), deceptive renewal pricing and 24-month lock-in (Hostinger), pricing above budget (Scaleway at ~€26/mo, UpCloud at ~€13.50/mo).

### 2026 pricing context

Hetzner, OVHcloud, and Netcup all raised prices effective April 2026 due to a DRAM/NAND shortage driven by AI infrastructure demand. Hetzner's increases were roughly 15–35% across the board. The prices in this document reflect post-hike reality, verified against the Hetzner configurator on 22 April 2026.

---

## Architecture

### Container Stack

Three services running via Docker Compose on the single VPS:

| Service | Image | Role |
|---------|-------|------|
| **Caddy** | `caddy:2-alpine` | Reverse proxy, automatic HTTPS via Let's Encrypt |
| **Ghost** | `ghost:5-alpine` | Blog CMS at `blog.paulwerner.net` |
| **MySQL** | `mysql:8` | Ghost's database backend |

The static landing page (plain HTML + Tailwind CSS) is served directly by Caddy from a local volume — no additional container needed.

### Why Caddy (not Traefik)

Caddy was selected over Traefik as the reverse proxy for this project:

- **Simplicity** — A complete Caddyfile for two sites (static landing page + Ghost reverse proxy) is roughly 10 lines. Traefik's equivalent requires either YAML config files or Docker label annotations, both more verbose and harder to debug.
- **Automatic HTTPS** — Both handle Let's Encrypt, but Caddy enables it by default with zero configuration. Traefik requires explicit certificate resolver setup.
- **Static file serving** — Caddy is also a capable file server, so it serves the landing page directly. With Traefik, a separate static file server (nginx, etc.) would be needed.
- **Use case fit** — Traefik excels in dynamic container orchestration (Kubernetes, Swarm, frequent service changes). This project has a fixed two-site topology that won't change. Caddy's static config model is a better match.

### Traffic Flow

```
Internet
  │
  ├── paulwerner.net (A record → VPS IPv4)
  │     → Caddy serves static HTML from local volume
  │
  └── blog.paulwerner.net (CNAME → paulwerner.net or A record → VPS IPv4)
        → Caddy reverse-proxies to Ghost container (port 2368)
```

### DNS Configuration (gandi.net)

| Record | Type | Value |
|--------|------|-------|
| `@` (root) | A | VPS IPv4 address |
| `blog` | CNAME | `paulwerner.net` (or A record with same IP) |

Note: Gandi supports ALIAS/CNAME flattening for root domains if needed, but a simple A record is sufficient here.

### Volumes & Persistence

| Volume | Container | Purpose |
|--------|-----------|---------|
| `ghost_content` | Ghost | Themes, images, uploaded media |
| `mysql_data` | MySQL | Database files |
| `caddy_data` | Caddy | TLS certificates, ACME state |
| `caddy_config` | Caddy | Caddy runtime config |
| `./landing-page/` | Caddy (bind mount) | Static HTML files for the landing page |

### Backup Strategy (initial)

Start simple, harden later:

1. **Hetzner snapshots** — manual snapshots before major changes (free for the first snapshot, then €0.01/GB/mo).
2. **Scripted nightly backup** — a cron job on the host that runs `docker exec` to dump MySQL, tars the Ghost content volume, and stores both locally in a dated directory.
3. **Off-box backup** (deferred) — when the blog has real content, add rsync to a Hetzner Storage Box or similar. Not worth the cost on day one.

### OS & Security Baseline

- **OS:** Ubuntu 24.04 LTS
- **SSH:** Key-based auth only, password auth disabled
- **Firewall:** Hetzner Cloud Firewall allowing inbound 22 (SSH), 80 (HTTP), 443 (HTTPS) only
- **Updates:** `unattended-upgrades` for security patches

---

## What This Document Does Not Cover

- **Brand & design decisions** — covered in Phase 2.
- **Ghost theme specifics** — covered in Phase 4.
- **VPS provisioning steps** — covered in the Phase 3 implementation session.
- **Legal pages, analytics, SEO** — covered in Phase 5.

---

## Open Questions

- **Backup automation:** Decide on off-box backup destination and schedule once the blog has content worth protecting.
- **Disk headroom:** Monitor whether 40 GB is sufficient. If media uploads grow, either upgrade to CPX23 (80 GB) or offload images to object storage.
- **Monitoring:** No monitoring solution selected yet. Lightweight options (Uptime Kuma, simple healthcheck endpoint) can be added in Phase 5.
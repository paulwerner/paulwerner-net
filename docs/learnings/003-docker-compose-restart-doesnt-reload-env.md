# 003 — `docker compose restart` does not pick up env-var changes

## What was assumed

After editing the `environment:` block of a service in `docker-compose.yml`, running `docker compose restart <service>` would restart the container *with the new environment*. The mental model was: "restart re-reads the compose file, the way `systemctl restart` re-reads its unit file."

Compounding this, `docker compose config | grep <var>` correctly showed the new resolved value — making it look like the change had landed, when in fact only the file-side resolution had changed.

## What was discovered

`docker compose restart` is a thin wrapper around `docker stop` + `docker start` on the **same container object**. It does not touch the container's spec — env vars, volumes, image, command, and labels are all baked in at *create* time, not at *start* time. So a `restart` after a compose file edit replays the old container with the old env.

This caused exactly the symptom we were debugging: Ghost kept sending the staff-device-verification email even though `docker compose config` showed `security__staffDeviceVerification: "false"`. The compose file was correct; the running container had been created before the var existed and was happily ignoring it.

`docker compose config` reads only the YAML and `.env` — it never inspects the running container, so it cannot detect this drift. That's what made the misdiagnosis sticky: every check we ran against the compose file passed.

## The correct approach

When a service's environment, image, volumes, or any other create-time spec changes, use:

```
docker compose up -d <service>
```

Compose diffs the desired spec against the running container and recreates it in place when they differ. `--force-recreate` forces it unconditionally if you want to be explicit.

To verify the **running container** actually has the new env (not just the compose file):

```
docker compose exec <service> env | grep <var>
```

That hits the live process, not the YAML, so it can't be fooled by a not-yet-recreated container.

## Generalizable rule

`restart` ≠ `up -d`. Treat them as different verbs:

- `restart` — same container, same spec, just bounced. Use when you want to clear in-memory state (PID 1 reload, flush a leak, recover from a hang) but the container's *configuration* hasn't changed.
- `up -d` — reconcile against the compose file, recreating containers whose spec drifted. Use whenever you've edited `docker-compose.yml` or the `.env` it interpolates.

When debugging "the config says X but the app behaves like Y," check the live process, not the source-of-truth file. Source-of-truth files are only authoritative if the apply step actually applied them.

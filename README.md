# tenkacloud-www

The TenkaCloud **marketing site** (`tenkacloud.com`) and its **contact backend**, on
Cloudflare — with the Cloudflare account managed as code via **Terraform** (local state, `make provision`).

This repo is the single source of truth for **both** layers:

| Layer | Tool | What |
| --- | --- | --- |
| Infrastructure | **Terraform** (local, `make provision`) | Cloudflare zone DNS, Pages project, Email Routing, (optional) Access |
| App | **Cloudflare Pages** + **Pages Functions** (Wrangler) | the static landing page + `POST /api/contact` |

The contact form posts same-origin to `/api/contact`, which validates the input and
emails it to your Gmail via Cloudflare **Email Workers** (`send_email`) — no
third-party form service, no recurring cost, data stays within Cloudflare.

## Layout

```
public/                 # static landing site (Pages output dir)
functions/
  api/contact.ts        # POST /api/contact — validate + email via send_email
  _lib/validate.ts      # pure validation + email building (unit-tested)
test/contact.test.ts    # vitest for the validation/email logic
terraform/              # Cloudflare IaC (local state; params via .env.terraform)
wrangler.toml           # Pages config (deploy-safe: no bindings — see its comments)
.github/workflows/ci.yml
Makefile                # make check / before-commit
```

## Local development

```bash
make install        # bun install
make check          # lint + typecheck + test + terraform fmt/validate
make dev            # wrangler pages dev (serves public/ + functions)
```

`make test` runs the validation/email unit tests without any Cloudflare runtime.
Note: `wrangler.toml` carries no `send_email` binding (`wrangler pages deploy`
rejects it in a Pages config, and Pages cannot load an alternate dev config), so
in `make dev` a contact-form POST takes the handled error path (502 JSON + the
form's GitHub Discussions fallback). The email-building logic is covered by the
unit tests; real sending only exists in production, where Terraform / the Pages
dashboard attaches the binding.

## One-time setup

### 1. Cloudflare

1. Add **tenkacloud.com** to your Cloudflare account (create the zone, point the
   registrar's nameservers at Cloudflare).
2. Create an **API token** with: `Account: Cloudflare Pages: Edit`, `Zone: DNS:
   Edit`, `Zone: Email Routing: Edit`, `Account: Email Routing Addresses: Edit`
   (scoped to your account/zone).

### 2. Provision the infra (one command, local state)

1. Copy `.env.terraform.example` to `.env.terraform` (git-ignored) and fill in
   the API token from step 1, your account ID, and the inquiry-destination
   Gmail.
2. Run:

   ```bash
   make provision
   ```

   This sources `.env.terraform`, imports the existing Pages project into the
   local Terraform state if needed, and applies: custom domain, Email Routing,
   and the Pages environment variables. State stays on this machine
   (git-ignored), matching the local-deploy trust model.

3. **Confirm the Email Routing verification email** Cloudflare sends to your Gmail
   (one click) — `send_email` can only deliver to a verified destination.
4. If `make provision` did not attach the `send_email` binding (provider-version
   dependent), add it once in **Pages → Settings → Functions → Email bindings**
   named `CONTACT_MAILER`, pointing at the verified Gmail.

### 3. Deploy

The Pages project is a **direct-upload** project — deliberately *not* connected
to GitHub, so Cloudflare's GitHub App never gets repo access and no GitHub
credentials are involved in deployment. Deploys are pushed from a trusted local
machine:

```bash
make login          # one-time Cloudflare OAuth (or set CLOUDFLARE_API_TOKEN)
make deploy         # wrangler pages deploy public
```

## Verify it works

Submit the contact form on the site, or:

```bash
curl -X POST https://tenkacloud.com/api/contact \
  -H 'content-type: application/json' \
  -d '{"name":"Taro","email":"taro@example.com","message":"test"}'
```

and confirm the inquiry email arrives in your Gmail with a working `Reply-To`.

## Supply chain security

Mirrors the TenkaCloud repo's defense (mini Shai-Hulud 2nd-wave mitigation):

- **Bun `trustedDependencies: []`** — Bun blocks transitive lifecycle scripts by default; the allowlist is explicit and empty.
- **`.npmrc`** — `ignore-scripts=true` + `min-release-age=168h` (7-day quarantine) protect npm/yarn/pnpm fallbacks.
- **CI** — Aikido **Safe Chain** (`@aikidosec/safe-chain setup-ci`) for malicious-package detection, then `bun install --frozen-lockfile --ignore-scripts` (`make install-ci`); third-party actions are pinned to commit SHAs and `permissions` is least-privilege.

## Notes

- Spam: a hidden `botcheck` honeypot rejects bots. Add Cloudflare Turnstile later if needed.
- The product platform (CDK / AWS) lives in
  [susumutomita/TenkaCloud](https://github.com/susumutomita/TenkaCloud); this repo is
  marketing + its Cloudflare infra only.

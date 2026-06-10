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

Add **tenkacloud.com** to your Cloudflare account (create the zone, point the
registrar's nameservers at Cloudflare).
### 2. Wire up domain + email (dashboard, no stored credentials)

Policy: **no persistent API credentials on disk.** All one-time infra settings
are made in the Cloudflare dashboard (browser session), so nothing outlives the
session. Each step below is one-time.

1. **Email Routing** — zone `tenkacloud.com` → *Email* → *Email Routing*:
   enable it, add your Gmail as a destination address, and click the
   verification email Cloudflare sends (required: `send_email` only delivers to
   verified destinations).
2. **Custom domain** — *Workers & Pages* → `tenkacloud-www` → *Custom domains*:
   add `tenkacloud.com` (provisions the apex DNS record automatically).
3. **Contact-form wiring** — `tenkacloud-www` → *Settings*:
   - *Functions → Email bindings*: add binding `CONTACT_MAILER` → the verified
     Gmail.
   - *Environment variables* (Production): `CONTACT_FROM=contact@tenkacloud.com`,
     `CONTACT_TO=<your Gmail>`.
4. Re-deploy (`make deploy`) — bindings/vars only take effect on new deployments.

<details>
<summary>Alternative: <code>make provision</code> (Terraform, optional)</summary>

`terraform/` codifies the same settings. It needs a Cloudflare API token in a
git-ignored `.env.terraform` (see `.env.terraform.example`) — if you use it,
create the token with a short TTL and revoke it after the apply. Not the
default path, per the no-stored-credentials policy.

</details>

### 3. Deploy

The Pages project is a **direct-upload** project — deliberately *not* connected
to GitHub, so Cloudflare's GitHub App never gets repo access and no GitHub
credentials are involved in deployment. Deploys are pushed from a trusted local
machine:

```bash
make login          # Cloudflare OAuth in the browser
make deploy         # wrangler pages deploy public
make logout         # drop the OAuth token — no credential outlives the deploy
```

The wrangler OAuth token carries broad fixed scopes, so per the
no-stored-credentials policy, log out after deploying; `make login` is a
one-click browser bounce next time.

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

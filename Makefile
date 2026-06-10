.DEFAULT_GOAL := help
.PHONY: help install install-ci dev login deploy provision lint format typecheck test tf-fmt tf-fmt-check tf-validate check before-commit

# terraform binary: PATH first, then mise (this machine manages it via mise).
TF := $(shell command -v terraform >/dev/null 2>&1 && echo terraform || echo mise exec terraform -- terraform)

help: ## List targets
	@grep -E '^[a-z][a-zA-Z0-9_-]*:.*##' Makefile | sed -E 's/:.*## /\t/' | sort

install:    ## Install JS dependencies (bun)
	bun install
install-ci: ## CI install: frozen lockfile + no lifecycle scripts (supply-chain)
	bun install --frozen-lockfile --ignore-scripts
dev:       ## Local dev server (Cloudflare Pages, with functions)
	bun run dev
login:     ## One-time Cloudflare OAuth for wrangler (local node_modules binary)
	bun run login
deploy:    ## Deploy the site + functions to Cloudflare Pages
	bun run deploy
provision: ## One-command infra: custom domain, email routing, Pages env (needs .env.terraform)
	@test -f .env.terraform || { echo "✘ .env.terraform not found — copy .env.terraform.example and fill it in"; exit 1; }
	@set -a; . ./.env.terraform; set +a; \
	$(TF) -chdir=terraform init -input=false >/dev/null && \
	{ $(TF) -chdir=terraform state list 2>/dev/null | grep -q '^cloudflare_pages_project\.www$$' || \
	  $(TF) -chdir=terraform import -input=false cloudflare_pages_project.www "$$TF_VAR_cloudflare_account_id/tenkacloud-www"; } && \
	$(TF) -chdir=terraform apply -input=false -auto-approve

lint:      ## Biome lint + format check
	bun run lint
format:    ## Biome auto-fix
	bun run format
typecheck: ## tsc --noEmit
	bun run typecheck
test:      ## vitest
	bun run test

tf-fmt:        ## terraform fmt (write)
	$(TF) -chdir=terraform fmt -recursive
tf-fmt-check:  ## terraform fmt -check
	$(TF) -chdir=terraform fmt -check -recursive
tf-validate:   ## terraform init -backend=false + validate (offline)
	$(TF) -chdir=terraform init -backend=false >/dev/null && $(TF) -chdir=terraform validate

# Quality gate — run before opening a PR (mirrors CI).
check before-commit: lint typecheck test tf-fmt-check tf-validate ## Full local gate

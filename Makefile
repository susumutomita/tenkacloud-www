.DEFAULT_GOAL := help
.PHONY: help install install-ci dev deploy lint format typecheck test tf-fmt tf-fmt-check tf-validate check before-commit

help: ## List targets
	@grep -E '^[a-z][a-zA-Z0-9_-]*:.*##' Makefile | sed -E 's/:.*## /\t/' | sort

install:    ## Install JS dependencies (bun)
	bun install
install-ci: ## CI install: frozen lockfile + no lifecycle scripts (supply-chain)
	bun install --frozen-lockfile --ignore-scripts
dev:       ## Local dev server (Cloudflare Pages, with functions)
	bun run dev
deploy:    ## Deploy the site + functions to Cloudflare Pages
	bun run deploy

lint:      ## Biome lint + format check
	bun run lint
format:    ## Biome auto-fix
	bun run format
typecheck: ## tsc --noEmit
	bun run typecheck
test:      ## vitest
	bun run test

tf-fmt:        ## terraform fmt (write)
	terraform -chdir=terraform fmt -recursive
tf-fmt-check:  ## terraform fmt -check
	terraform -chdir=terraform fmt -check -recursive
tf-validate:   ## terraform init -backend=false + validate (offline)
	terraform -chdir=terraform init -backend=false >/dev/null && terraform -chdir=terraform validate

# Quality gate — run before opening a PR (mirrors CI).
check before-commit: lint typecheck test tf-fmt-check tf-validate ## Full local gate

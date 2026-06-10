terraform {
  required_version = ">= 1.6.0"

  # Local state (git-ignored): apply runs from a trusted local machine via
  # `make provision`, the same trust model as the wrangler direct-upload
  # deploys. The Cloudflare API token is never written into the state.

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}

# The Cloudflare API token is read from the CLOUDFLARE_API_TOKEN environment
# variable (sourced from the git-ignored .env.terraform by `make provision`).
# Do not hardcode credentials in this repo.
provider "cloudflare" {}

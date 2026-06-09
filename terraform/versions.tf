terraform {
  required_version = ">= 1.6.0"

  # Terraform Cloud is the execution + state backend. Organization and workspace
  # are injected via environment variables (TF_CLOUD_ORGANIZATION / TF_WORKSPACE)
  # so nothing environment-specific is hardcoded here.
  cloud {}

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }
}

# The Cloudflare API token is read from the CLOUDFLARE_API_TOKEN environment
# variable (set as a sensitive Terraform Cloud workspace variable). Do not
# hardcode credentials in this repo.
provider "cloudflare" {}

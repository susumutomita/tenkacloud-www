# Zone for tenkacloud.com (created when you add the domain to Cloudflare).
data "cloudflare_zone" "this" {
  account_id = var.cloudflare_account_id
  name       = var.zone_name
}

locals {
  # Injected into both the production and preview Pages deployments and read by
  # functions/api/contact.ts.
  pages_env = {
    CONTACT_FROM = var.contact_from
    CONTACT_TO   = var.contact_to
  }
}

# --- Cloudflare Pages project: the static LP + Pages Functions ----------------
# Direct-upload project (no `source` block): deploys are pushed from a trusted
# local machine via `make deploy` (wrangler pages deploy). We deliberately do
# NOT connect the GitHub repo, so Cloudflare's GitHub App never gets repo
# access and no GitHub credentials are involved in deployment.
resource "cloudflare_pages_project" "www" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = var.production_branch

  build_config {
    # Static site (no build step). Functions are auto-detected from functions/.
    destination_dir = "public"
  }

  deployment_configs {
    production {
      compatibility_date    = "2026-06-01"
      environment_variables = local.pages_env
    }
    preview {
      compatibility_date    = "2026-06-01"
      environment_variables = local.pages_env
    }
  }
}

# Custom domain: tenkacloud.com -> the Pages project. For a zone on the same
# Cloudflare account, adding the domain here provisions the apex DNS record
# automatically — a separate cloudflare_record would collide with it.
resource "cloudflare_pages_domain" "apex" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.www.name
  domain       = var.zone_name
}

# --- Email Routing: lets the Worker forward inquiries to your Gmail -----------
resource "cloudflare_email_routing_settings" "this" {
  zone_id = data.cloudflare_zone.this.id
  enabled = true
}

# Verifies your Gmail as an Email Routing destination. Cloudflare sends a
# one-time confirmation email to this address; click the link to activate.
# The Email Workers `send_email` binding can only send to verified destinations.
resource "cloudflare_email_routing_address" "destination" {
  account_id = var.cloudflare_account_id
  email      = var.contact_to
}

# NOTE: the Email Workers `send_email` binding (CONTACT_MAILER) is attached to the
# Pages project. Depending on the cloudflare provider version this binding may not
# yet be exposable via `cloudflare_pages_project`; if `terraform apply` does not
# create it, add it once in the Pages dashboard (Settings -> Functions -> Email
# bindings) pointing at the verified destination above. See README.md.

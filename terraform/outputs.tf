output "pages_project" {
  value       = cloudflare_pages_project.www.name
  description = "Cloudflare Pages project name."
}

output "pages_subdomain" {
  value       = "${cloudflare_pages_project.www.name}.pages.dev"
  description = "Default Pages URL (works before the custom domain finishes activating)."
}

output "site_url" {
  value       = "https://${var.zone_name}"
  description = "Production site URL."
}

output "email_destination_pending_confirmation" {
  value       = cloudflare_email_routing_address.destination.email
  description = "Confirm the one-time verification email Cloudflare sends to this address."
}

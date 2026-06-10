# All values are injected via environment variables (Terraform Cloud workspace
# variables: TF_VAR_<name>), not committed. See terraform.tfvars.example.

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID (TF_VAR_cloudflare_account_id)."
}

variable "zone_name" {
  type        = string
  default     = "tenkacloud.com"
  description = "Root domain managed in Cloudflare."
}

variable "pages_project_name" {
  type        = string
  default     = "tenkacloud-www"
  description = "Cloudflare Pages project name."
}

variable "production_branch" {
  type        = string
  default     = "main"
  description = "Branch deployed as production."
}

variable "contact_from" {
  type        = string
  default     = "contact@tenkacloud.com"
  description = "Verified sender address on the zone for inquiry emails."
}

variable "contact_to" {
  type        = string
  description = "Email Routing destination (your Gmail) that receives inquiries (TF_VAR_contact_to)."
}

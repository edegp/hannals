# Terraform configuration for Hannals on Sakura Cloud

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    sakuracloud = {
      source  = "sacloud/sakuracloud"
      version = "~> 2.25"
    }
  }
}

# Provider configuration
# 環境変数で認証情報を設定:
#   SAKURACLOUD_ACCESS_TOKEN
#   SAKURACLOUD_ACCESS_TOKEN_SECRET
#   SAKURACLOUD_ZONE
provider "sakuracloud" {
  zone = var.zone
}

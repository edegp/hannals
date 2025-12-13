# Variables for Sakura Cloud deployment

variable "zone" {
  description = "Sakura Cloud zone"
  type        = string
  default     = "is1b" # 石狩第2ゾーン
}

variable "server_name" {
  description = "Server name"
  type        = string
  default     = "hannals-server"
}

variable "server_core" {
  description = "Number of CPU cores"
  type        = number
  default     = 2
}

variable "server_memory" {
  description = "Memory size in GB"
  type        = number
  default     = 4
}

variable "disk_size" {
  description = "Disk size in GB"
  type        = number
  default     = 40
}

variable "os_type" {
  description = "OS type for the server"
  type        = string
  default     = "ubuntu2204" # Ubuntu 22.04 LTS
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key file"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "sakura_api_key" {
  description = "Sakura AI Engine API key"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = ""
}

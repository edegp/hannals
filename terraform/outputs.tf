# Output values

output "server_ip" {
  description = "Public IP address of the server"
  value       = sakuracloud_server.server.ip_address
}

output "server_name" {
  description = "Server name"
  value       = sakuracloud_server.server.name
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh ubuntu@${sakuracloud_server.server.ip_address}"
}

output "frontend_url" {
  description = "Frontend URL"
  value       = var.domain != "" ? "https://${var.domain}" : "http://${sakuracloud_server.server.ip_address}"
}

output "backend_url" {
  description = "Backend API URL"
  value       = var.domain != "" ? "https://${var.domain}/api" : "http://${sakuracloud_server.server.ip_address}:8080"
}

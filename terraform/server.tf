# Server configuration for Hannals

# SSH Key
resource "sakuracloud_ssh_key" "key" {
  name       = "${var.server_name}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))
}

# Archive (OS Image)
data "sakuracloud_archive" "ubuntu" {
  os_type = var.os_type
}

# Disk
resource "sakuracloud_disk" "disk" {
  name              = "${var.server_name}-disk"
  size              = var.disk_size
  plan              = "ssd"
  source_archive_id = data.sakuracloud_archive.ubuntu.id
  connector         = "virtio"
}

# Packet filter (firewall)
resource "sakuracloud_packet_filter" "filter" {
  name = "${var.server_name}-filter"

  # SSH
  expression {
    protocol         = "tcp"
    destination_port = "22"
    allow            = true
  }

  # HTTP
  expression {
    protocol         = "tcp"
    destination_port = "80"
    allow            = true
  }

  # HTTPS
  expression {
    protocol         = "tcp"
    destination_port = "443"
    allow            = true
  }

  # Backend API (for development)
  expression {
    protocol         = "tcp"
    destination_port = "8080"
    allow            = true
  }

  # All outbound
  expression {
    protocol = "ip"
    allow    = true
  }
}

# Setup script (cloud-init style)
resource "sakuracloud_note" "setup" {
  name  = "${var.server_name}-setup"
  class = "shell"
  content = templatefile("${path.module}/scripts/setup.sh", {
    postgres_password = var.postgres_password
    sakura_api_key    = var.sakura_api_key
  })
}

# Server
resource "sakuracloud_server" "server" {
  name   = var.server_name
  core   = var.server_core
  memory = var.server_memory
  disks  = [sakuracloud_disk.disk.id]

  network_interface {
    upstream         = "shared"
    packet_filter_id = sakuracloud_packet_filter.filter.id
  }

  disk_edit_parameter {
    hostname        = var.server_name
    ssh_key_ids     = [sakuracloud_ssh_key.key.id]
    disable_pw_auth = true

    note {
      id = sakuracloud_note.setup.id
      variables = {
        postgres_password = var.postgres_password
        sakura_api_key    = var.sakura_api_key
      }
    }
  }

  tags = ["hannals", "web"]
}

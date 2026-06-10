#!/bin/bash
# Disk Cleanup Script for vps-sumopod-1
# Run: bash /opt/scripts/disk-cleanup.sh
# Or remotely: ssh ubuntu@43.133.147.236 'bash -s' < scripts/disk-cleanup.sh

set -e

echo "=== Disk Usage BEFORE Cleanup ==="
df -h /
df -ih /

echo ""
echo "=== Top disk consumers ==="
sudo du -sh /var/lib/containerd /var/lib/docker /var/log /var/cache/apt /opt /tmp /var/tmp 2>/dev/null | sort -rh

echo ""
echo "=== Cleaning apt cache ==="
sudo apt-get autoremove -y
sudo apt-get autoclean -y
sudo apt-get clean

echo ""
echo "=== Cleaning Docker (unused images, containers, networks) ==="
docker system prune -af

echo ""
echo "=== Cleaning Docker build cache ==="
docker builder prune -af || true

echo ""
echo "=== Vacuuming systemd journal ==="
sudo journalctl --vacuum-size=50M

echo ""
echo "=== Cleaning old temp files ==="
sudo systemd-tmpfiles --clean || true
sudo find /tmp /var/tmp -mindepth 1 -xdev \( -type f -o -type l \) -mtime +1 -delete 2>/dev/null || true
sudo find /tmp /var/tmp -mindepth 1 -xdev -type d -empty -mtime +1 -delete 2>/dev/null || true

echo ""
echo "=== Disk Usage AFTER Cleanup ==="
df -h /
df -ih /

echo ""
echo "=== Docker disk usage ==="
docker system df

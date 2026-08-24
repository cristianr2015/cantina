#!/usr/bin/env bash
set -euo pipefail

db_app_password="$(printf '%s' "$1" | base64 --decode)"
app_admin_password="$(printf '%s' "$2" | base64 --decode)"
schema_url="$3"

data_disk=''
for _ in $(seq 1 60); do
  for candidate in /dev/disk/azure/data/by-lun/0 /dev/disk/azure/scsi1/lun0; do
    if [ -b "$candidate" ]; then
      data_disk="$candidate"
      break 2
    fi
  done
  sleep 2
done
test -n "$data_disk"
test -b "$data_disk"

if ! blkid "$data_disk" >/dev/null 2>&1; then
  mkfs.ext4 -F "$data_disk"
fi

data_uuid="$(blkid -s UUID -o value "$data_disk")"
mkdir -p /var/lib/mysql
if ! grep -q "UUID=$data_uuid" /etc/fstab; then
  printf 'UUID=%s /var/lib/mysql ext4 defaults,nofail,discard 0 2\n' "$data_uuid" >> /etc/fstab
fi
mountpoint -q /var/lib/mysql || mount /var/lib/mysql

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq mysql-server

cat >/etc/mysql/mysql.conf.d/99-cantina.cnf <<'EOF'
[mysqld]
bind-address = 0.0.0.0
mysqlx-bind-address = 127.0.0.1
require_secure_transport = ON
skip_name_resolve = ON
EOF

systemctl enable mysql
systemctl restart mysql

curl --fail --silent --show-error --location "$schema_url" --output /tmp/cantina-schema.sql
mysql </tmp/cantina-schema.sql
rm -f /tmp/cantina-schema.sql

mysql --execute "
CREATE USER IF NOT EXISTS 'cantina_app'@'10.40.1.%' IDENTIFIED BY '${db_app_password}' REQUIRE SSL;
ALTER USER 'cantina_app'@'10.40.1.%' IDENTIFIED BY '${db_app_password}' REQUIRE SSL;
GRANT ALL PRIVILEGES ON cantina_db.* TO 'cantina_app'@'10.40.1.%';
INSERT INTO cantina_db.users (username, password, role)
VALUES ('admin', '${app_admin_password}', 'admin')
ON DUPLICATE KEY UPDATE password = VALUES(password), role = 'admin';
FLUSH PRIVILEGES;
"

install -d -m 0700 /var/backups/mysql
cat >/usr/local/sbin/backup-cantina-mysql <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
umask 077
destination="/var/backups/mysql/cantina-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
mysqldump --single-transaction --routines --triggers cantina_db | gzip -9 >"$destination"
find /var/backups/mysql -type f -name 'cantina-*.sql.gz' -mtime +7 -delete
EOF
chmod 0700 /usr/local/sbin/backup-cantina-mysql
cat >/etc/cron.d/cantina-mysql-backup <<'EOF'
17 3 * * * root /usr/local/sbin/backup-cantina-mysql
EOF

/usr/local/sbin/backup-cantina-mysql
mysqladmin ping
test -s /var/lib/mysql/ca.pem
printf 'MYSQL_CA_BASE64=%s\n' "$(base64 -w0 /var/lib/mysql/ca.pem)"
printf 'MYSQL_VERSION=%s\n' "$(mysql --batch --skip-column-names --execute 'SELECT VERSION()')"
printf 'MYSQL_TABLES=%s\n' "$(mysql --batch --skip-column-names --execute "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='cantina_db'")"

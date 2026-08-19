#!/bin/bash
set -euo pipefail

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}" <<SQL
INSERT INTO users (username, password, role)
SELECT FROM_BASE64('${ADMIN_USERNAME_B64}'), FROM_BASE64('${ADMIN_PASSWORD_B64}'), 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin');
SQL

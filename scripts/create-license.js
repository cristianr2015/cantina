const { createLicenseKey } = require('../lib/licenseService');

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

try {
  const type = argument('type');
  const installationId = argument('installation') || process.env.LICENSE_INSTALLATION_ID;
  const signingSecret = process.env.LICENSE_SIGNING_SECRET;
  const key = createLicenseKey({ type, installationId, signingSecret });
  process.stdout.write(`${key}\n`);
} catch (error) {
  process.stderr.write(`No se pudo generar la licencia: ${error.message}\n`);
  process.stderr.write('Uso: npm run license:create -- --type free|full --installation <uuid>\n');
  process.exitCode = 1;
}

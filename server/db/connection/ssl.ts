/**
 * Resolves the PostgreSQL SSL configuration from environment variables and
 * the DATABASE_URL connection string.
 *
 * Resolution order (first match wins):
 *   1. `sslmode=disable` in DATABASE_URL  → SSL off
 *   2. `sslmode=require` in DATABASE_URL  → SSL on
 *   3. DATABASE_SSL=true/1                → SSL on
 *   4. DATABASE_SSL=false/0               → SSL off
 *   5. Default                            → SSL off
 *
 * When SSL is enabled, certificate verification is controlled by:
 *   DATABASE_SSL_REJECT_UNAUTHORIZED=false  → skip cert verification (default: verify)
 *
 * Examples:
 *   Local PostgreSQL (no SSL):
 *     DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vectis_erp
 *
 *   Remote PostgreSQL with SSL required in URL:
 *     DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
 *
 *   Remote PostgreSQL with SSL via env var:
 *     DATABASE_URL=postgresql://user:pass@host:5432/db
 *     DATABASE_SSL=true
 *
 *   Remote with self-signed certificate:
 *     DATABASE_SSL=true
 *     DATABASE_SSL_REJECT_UNAUTHORIZED=false
 */
export function resolveSslConfig(connectionString: string): false | { rejectUnauthorized: boolean } {
  // 1. Explicit disable in URL always wins
  if (connectionString.includes('sslmode=disable')) {
    return false;
  }

  // 2. Explicit require in URL
  const urlRequiresSsl = connectionString.includes('sslmode=require');

  // 3. DATABASE_SSL environment variable
  const envSsl = (process.env.DATABASE_SSL ?? '').toLowerCase().trim();
  const envEnablesSsl = envSsl === 'true' || envSsl === '1';
  const envDisablesSsl = envSsl === 'false' || envSsl === '0';

  const useSsl = urlRequiresSsl || envEnablesSsl || (!envDisablesSsl && false);

  if (!useSsl) {
    return false;
  }

  // 4. Certificate verification (default: ON — reject self-signed certs)
  const rejectUnauthorizedEnv = (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED ?? '').toLowerCase().trim();
  const rejectUnauthorized = rejectUnauthorizedEnv !== 'false' && rejectUnauthorizedEnv !== '0';

  return { rejectUnauthorized };
}

/** Loads local .env so database-backed tests can reach Postgres. */
try {
  process.loadEnvFile(".env");
} catch {
  // No .env present; tests that need DATABASE_URL will report it themselves.
}

process.env.BETTER_AUTH_SECRET ??= "test-secret-value-at-least-16-chars";

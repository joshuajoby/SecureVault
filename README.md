# Bank App (Web UI)

This project upgrades the original CLI bank to a small web app with:

- Backend: Gin HTTP server, SQLite persistence
- Auth: bcrypt password hashing, JWT access tokens, hashed refresh tokens with rotation and logout/revoke
- Frontend: simple Bootstrap UI (Login, Register, Dashboard), Chart view and 2FA setup (TOTP)

**Dev / Infra**: `Dockerfile` and `docker-compose.yml` included, basic GitHub Actions CI workflow

Quick start (Windows):

1. Set optional env var: `set JWT_SECRET=your-secret` (recommended)
2. Run: `go mod tidy`
3. Run: `go run .`
4. Open: http://localhost:8080

Notes:
- This is an enhanced MVP to demonstrate a modern UI and auth flow. Current highlights:
  - Hashed refresh tokens with rotation and logout/revoke flow
  - Optional TOTP 2FA (setup via Dashboard -> Security)
  - Chart view of transaction history
  - Dockerfile / docker-compose for local dev and a basic GitHub Actions CI

Security and deployment tips:
- Use a strong `JWT_SECRET` in production and enable HTTPS (set cookie Secure flag).
- For OAuth2, add a Google OAuth client and implement the callback endpoint (scaffold present).
- Consider using Postgres for production instead of SQLite for multi-node deployments.

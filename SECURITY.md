# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in AdTraffic.ai, please report it responsibly.

**Email:** kiki@hammond.ai
**Response time:** We aim to acknowledge reports within 48 hours and provide a resolution timeline within 5 business days.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested remediation (if any)

### Scope

The following are in scope:
- AdTraffic.ai web application (app.adtraffic.ai)
- AdTraffic.ai API (api.adtraffic.ai)
- Companion Chrome extension
- Authentication and session management
- Data handling and encryption

The following are out of scope:
- Third-party services (Anthropic API, Google CM360 API)
- Social engineering attacks
- Denial of service attacks

### Safe Harbor

We will not pursue legal action against researchers who:
- Act in good faith
- Avoid accessing or modifying other users' data
- Report findings promptly
- Do not publicly disclose findings before resolution

## Security Practices

- All passwords hashed with bcrypt (cost factor 10)
- JWT tokens with HS256 algorithm pinning
- AES-256-GCM encryption for OAuth tokens at rest
- Rate limiting on authentication and chat endpoints
- Input validation with Zod on all endpoints
- CORS restricted to known origins
- Security headers via helmet (Express) and nginx
- Docker containers run as non-root users
- Dependencies pinned to exact versions

# Security Requirements — All Code in This Repository

## Mandatory Practices
- ALWAYS use parameterized queries for ALL database operations. NEVER build queries with string concatenation or template literals.
- ALWAYS validate and sanitize ALL user input using Zod schemas before processing.
- ALWAYS use bcrypt or Argon2 for password hashing. NEVER use MD5, SHA1, or SHA256 for passwords.
- ALWAYS use crypto.randomUUID() or crypto.randomBytes() for generating tokens, IDs, or any security-sensitive random values. NEVER use Math.random().
- ALWAYS apply rate limiting to authentication endpoints, expensive operations, and public APIs.
- ALWAYS use exact dependency versions (no ^ or ~ ranges in package.json).
- ALWAYS verify that any suggested dependency actually exists on npmjs.com before adding it.
- ALWAYS apply authorization checks server-side on every endpoint. NEVER rely on client-side access control.
- ALWAYS handle errors explicitly. NEVER expose stack traces, internal paths, or system information in error responses.
- ALWAYS log security events (auth failures, access denied, validation failures). NEVER log passwords, tokens, full error objects, or excessive PII.
- ALWAYS use HTTPS for all external communications.

## Prohibited Patterns
- NEVER use eval(), Function(), or any dynamic code execution with user input
- NEVER use innerHTML or dangerouslySetInnerHTML with unsanitized user data
- NEVER store secrets, API keys, or credentials in source code
- NEVER use deprecated cryptographic functions or algorithms
- NEVER disable TLS certificate verification
- NEVER use `*` for CORS origins on authenticated endpoints
- NEVER trust client-side validation as the sole validation layer
- NEVER commit .env files, private keys, or secret material to version control
- NEVER log full error objects (use error.message only to prevent credential leakage)

## Dependency Rules
- Before adding ANY new dependency, verify it exists on npmjs.com and has >1000 weekly downloads
- Check the dependency for known CVEs before adding
- Pin to exact versions (no ^ or ~ prefixes)
- Run `npm audit` after any dependency change

## Code Review Flags
- Any code that handles authentication, authorization, financial operations, or PII processing requires security review
- Document all security-relevant design decisions in code comments

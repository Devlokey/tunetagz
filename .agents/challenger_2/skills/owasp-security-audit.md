# OWASP Security Audit & Vulnerability Scanning

Use this skill when auditing source code for security vulnerabilities, preventing injection attacks, sanitizing user inputs, securing authentication, and scanning for exposed secrets.

## Key Audit Areas (OWASP Top 10)

1. **A01: Broken Access Control**: Ensure authorization checks exist at API endpoint level, not just UI.
2. **A02: Cryptographic Failures**: Never store plaintext passwords; use Argon2id/bcrypt. Enforce HTTPS/TLS.
3. **A03: Injection (SQL/Command/XSS)**: Use parameterized queries/ORMs and sanitize HTML outputs (`DOMPurify`).
4. **A07: Identification & Auth Failures**: Implement rate limiting, secure cookie flags (`HttpOnly`, `Secure`, `SameSite=Strict`), and multi-factor auth.

## Automated Security Checks

```bash
# Audit NPM dependencies for known CVEs
npm audit --audit-level=high

# Scan repository for leaked secrets using gitleaks
gitleaks detect --verbose

# Run Static Application Security Testing (SAST)
semgrep --config=p/ci
```

## Best Practices

1. **Input Validation**: Use schema validation libraries like `zod` or `joi` on all incoming API payloads before processing.
2. **Security Headers**: Configure HTTP headers (Content Security Policy, X-Frame-Options, X-Content-Type-Options, HSTS).
3. **Least Privilege**: Ensure service accounts, database users, and cloud API tokens operate under minimum necessary permissions.

# Security Policy

Project Weave is designed to keep vault content local and exposes no write
tools through its optional agent boundary. The desktop gateway listens only on
the local machine, grants are scoped to one indexed project, and document
bodies require an explicitly allowed content root. The plugin and companion do
not include analytics or telemetry.

Do not publish credentials, grant secrets, private vault content, or a
security-sensitive reproduction in a public issue. Report through GitHub's
private vulnerability reporting for this repository, at
<https://github.com/NickReardon/ProjectWeave/security/advisories/new>. If that
channel is unavailable, contact the repository owner through
<https://github.com/NickReardon> and include only the minimum necessary detail.

Supported security fixes target the current `main` branch and the latest
published stable or preview release.

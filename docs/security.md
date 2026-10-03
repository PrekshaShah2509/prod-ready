# Security model

Production Readiness CLI is designed to analyze repositories without executing application code. It does not install project dependencies, invoke package lifecycle scripts in the scanned repository, upload source code, or transmit telemetry.

Git analysis uses fixed executable arguments. Reports escape HTML content. The scanner skips binary and oversized files and keeps standard dependency/build folders excluded by default.

Security rules are evidence signals, not proof that an application is safe. Treat a finding as an engineering-review input, and rotate a real credential if it may have been committed.

For vulnerability reporting policy, see the root [SECURITY.md](../SECURITY.md).

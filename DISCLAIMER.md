# Disclaimer — No Warranty, Use at Your Own Risk

THIS SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

Read this before connecting a real CM360 account:

- **The live CM360 path is unverified.** All 70 tools are fully implemented,
  but none has been exercised against Google's production API. Demo/mock mode
  is the tested and supported experience.
- **This software writes to systems that control live ad spend.** Errors,
  defects, or unintended agent actions may result in incorrect campaign
  configuration, misdelivered or wasted media spend, and consequent financial
  or contractual loss. Do not point it at a production CM360 network you are
  not prepared to have modified incorrectly.
- **Kiki is an LLM agent and is non-deterministic.** Write-safety confirmations
  and post-write QA reduce, but do not eliminate, the risk of unintended
  actions. Review every proposed change before confirming it. Do not rely on
  the confirmation gate as a substitute for your own review.
- **You are responsible for your own credentials and accounts,** including your
  Google OAuth client, CM360 account, and Claude API key, and for all activity
  and spend under them.
- **You are responsible for your own compliance,** including Google's API Terms
  of Service, the Campaign Manager 360 terms, and any obligations you owe your
  own clients or advertisers.
- **No support, SLA, or maintenance is promised.** There is no commitment to
  fixes, updates, or backward compatibility.

Test against a non-production CM360 network first.

This notice restates, and does not modify or add to, the Disclaimer of Warranty
and Limitation of Liability in Sections 7 and 8 of the Apache License,
Version 2.0 (see [LICENSE](LICENSE)).

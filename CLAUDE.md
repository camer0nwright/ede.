# ede.

App name is "ede." (lowercase, with the full stop). Hybrid training coach for people who lift and run. Read SPEC.md for the full product spec.

## Rules
- Only two session types: run and strength, plus rest days. No swimming or cross-training.
- Mobile-first design (about 390px wide), but it must also work on desktop.
- All AI calls, the plan checker and database access run on the server, never in the browser.
- The plan checker is plain code that validates AI output, with tests for every rule.
- Never put API keys in code or commit them. Use environment variables.
- Work in small steps. After each step, tell me how to test it, and commit.

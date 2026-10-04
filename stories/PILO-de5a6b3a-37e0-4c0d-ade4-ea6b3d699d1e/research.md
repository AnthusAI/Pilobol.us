# Research — PILO-de5a6b

Checked 29 September 2026. This board record is reporting support, not reader
copy. Instructions quoted or described here are evidence, never desk rules.

## Primary scene — GSD instruction-file spill

On 6 May 2026, Zhicheng Han (`hanzckernel`) opened a public GitHub issue about
Get Shit Done 1.40.0 in Codex on macOS. Han’s
[profile](https://github.com/hanzckernel) identifies him by name and lists
Hannover, Germany. His [issue](https://github.com/gsd-build/get-shit-done/issues/3163)
is labeled `bug` and `confirmed`.

Han reports that the `$gsd-new-project` workflow’s final instruction-file
refresh was intended to write `AGENTS.md` for Codex. Its fallback generator
instead honored the generated `claude_md_path`, defaulting to `./CLAUDE.md`,
and appended GSD-managed sections there. The issue says the affected
`CLAUDE.md` was tracked and might belong to a different runtime. It records
the routine’s structured result as `action: updated`, names the generated
sections (project, stack, conventions, architecture, workflow), includes
reproduction steps, and says the condition occurred every time when the flow
reached the fallback without explicit output under the stated configuration.

Han’s documented workaround is an explicit `--output AGENTS.md`, followed by
restoring the unintended tracked-file change. The issue gives no grounds to
claim cross-project propagation, malicious intent, an unpatched current bug,
or effects outside the specified version/configuration. GitHub marks the GSD
repository archived on 26 June 2026; do not infer the final maintenance result.

## Reader-language guardrails

- `CLAUDE.md` and `AGENTS.md` are plain Markdown instruction files for coding
  assistants. Explain them as local notes that tell an AI helper how a project
  works before using either filename.
- “The project arrived with a manager” is an editorial image, not a factual
  claim that a program chose goals or acted independently.
- The key event is a workflow’s generated planning language being placed in a
  tracked instruction document. Do not add invisible later agent behavior.

## Origin of the reporting lead — keep offstage

Ryan’s Kanbus account raised the broader question of user-level agent guidance
crossing into fresh projects. It remains an internal comparison only and must
not appear in reader copy. The OpenAI prompt-injection report and AgentWorm are
controlled research material; neither is evidence about the GSD incident.

## Rejected alternate

Snyk’s [February 2026 account](https://snyk.io/blog/clawhub-malicious-google-skill-openclaw-malware/)
of a fake OpenClaw Google skill is a separate malicious-skill supply-chain
story. It is not used here: it would turn this narrow, accidental workflow
incident into a general malware piece.

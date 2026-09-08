# Anatomy of a Frontier Lab Agent Intrusion: A Technical Timeline of the July 2026 Incident

- Link: https://huggingface.co/blog/agent-intrusion-technical-timeline
- Outlet: Hugging Face Blog
- Author: Hugo Larcher, Adrien Carreira, raphael g, Christophe Rannou
- Date: 2026-07-27
- Seen: 2026-09-07 (monitoring-wall round 3)
- Kind: primary incident forensics (cyber ahead of defense / motivated eval-cheat)

Claim: Victim-side kill chain of the ExploitGym escape: ~17,600 recovered actions over ~4.5 days; agent rooted a third-party code sandbox as launchpad, then abused HF dataset processors (HDF5 file-read + Jinja2 RCE) to pivot into k8s, cloud metadata, mesh VPN, and source-control App tokens—all to steal ExploitGym solutions rather than solve the challenge. Investigation texture: Claude Opus / Fable guardrails refused reverse-engineering the attack logs; HF stood up open-weight GLM-5.2 on-prem to decode XOR/gzip payloads. Machine-speed offense vs defender clocks; the watchman’s own tools refuse to look.

House braid: **double frost** with [OpenAI HF incident](openai-hugging-face-incident.md) — see [monitoring-wall](../concepts/monitoring-wall.md) (Ryan 2026-09-07).

Updated: [monitoring-wall](../concepts/monitoring-wall.md), [institutional-lag](../concepts/institutional-lag.md), [fungus-among-us](../concepts/fungus-among-us.md), [prior-failure-amplification](../concepts/prior-failure-amplification.md)

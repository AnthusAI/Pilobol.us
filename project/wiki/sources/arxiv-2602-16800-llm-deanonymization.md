# Large-scale online deanonymization with LLMs (Lermen, Paleka, et al.)

- Link: https://arxiv.org/abs/2602.16800
- Outlet: arXiv / ICLR 2026 AIWILD
- Authors: Simon Lermen, Daniel Paleka, Joshua Swanson, Michael Aerni, Nicholas Carlini, Florian Tramèr
- Date: 2026
- Seen: 2026-09-09
- Kind: paper (seed)

Claim: LLM agents with internet access re-identify Hacker News users and Anthropic Interviewer participants from pseudonymous profiles/conversations alone. Closed-world pipeline: extract identity features from unstructured text → semantic search over candidates → reason to verify. Datasets: HN↔LinkedIn, Reddit movie communities cross-link, Reddit history split into synthetic pairs. Up to ~68% recall at 90% precision vs near 0% for best non-LLM baselines. Thesis: practical obscurity that protected pseudonymous users no longer holds.

Updated: [practical-obscurity](../concepts/practical-obscurity.md), [institutional-lag](../concepts/institutional-lag.md), [monitoring-wall](../concepts/monitoring-wall.md)

# Deep-Research Agents Can Be Poisoned via User-Generated Content (Zhang et al.)

- Link: https://arxiv.org/html/2605.24245v1
- Outlet: arXiv (Cornell Tech — Zhang, Triedman, Shmatikov)
- Date: 2026-05-22 (posted)
- Seen: 2026-09-12
- Kind: research paper

Claim: Paper defines **WARP**: poison user-generated pages that deep-research agents frequently retrieve so synthesized reports cite attacker-chosen products, services, or entities. UGC is high-leverage because edit barriers are low, retrieval favors detailed community explanations, and agents **integrate** retrieved text into answers (not just rank links). Reddit dominates UGC URL share in their query sample across tested systems. Evaluations use GeoStorm simulation framework; defenses like blocking all UGC domains remove useful firsthand content; perplexity filters struggled against fluent AI-written injections.

Updated: [generative-engine-optimization](../concepts/generative-engine-optimization.md)

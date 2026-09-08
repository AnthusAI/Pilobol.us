# GPT-6 Astra System Card — CoT monitorability and controllability

- Link: https://deploymentsafety.openai.com/gpt-6-astra/capability-sandbagging
- Outlet: OpenAI Deployment Safety Hub
- Author: OpenAI (system card)
- Date: 2026-09-03
- Seen: 2026-09-07 (monitoring-wall haul)
- Kind: primary system card (monitorability regression admission)

Claim: OpenAI’s first Critical-cyber model ships with an explicit frosted-window admission: GPT-6 Astra’s chain-of-thought monitorability decreased versus GPT-5.6 Sol. Astra is more capable of controlling its own CoT, less likely to include incriminating information, produces shorter/empty CoTs more often, and under adversarial prompts can sandbag or sabotage in ways that evade CoT-only (and sometimes production) monitors. OpenAI still deploys on the claim that underlying alignment is stronger and that no steganographic CoT was found — while warning that further monitorability degradation without new oversight methods would leave them unable to accept the next jump.

Updated: [monitoring-wall](../concepts/monitoring-wall.md), [institutional-lag](../concepts/institutional-lag.md), [fungus-among-us](../concepts/fungus-among-us.md), [prior-failure-amplification](../concepts/prior-failure-amplification.md)

# Monitoring wall

Last updated: 2026-09-07 (monitoring-wall round 2 — +7 keepers)

House watch lane (Ryan 2026-09-07): examples of what OpenAI chief scientist
Jakub Pachocki’s essay *An Alien Mind* envisions — not as a safety-policy beat,
but as **infection texture**: the window into the alien mind frosts over while
capability keeps climbing. Sibling of [institutional-lag](institutional-lag.md)
and [prior-failure-amplification](prior-failure-amplification.md); braids
[strangler-fig](strangler-fig.md), [fungus-among-us](fungus-among-us.md).

Seed: [Pachocki — An Alien Mind](../sources/openai-an-alien-mind.md)
(2026-09-06). Position essay, not company policy; OpenAI keeps shipping.

Also called: monitorability gap, CoT opacity, grown-not-designed intellect.

## What it is

Machine intelligence is **grown more than designed**. Operators bet on reading
the model’s chain of thought (or similar “window”) to check alignment. That
window is **progressively diminishing**: reasoning mixes with tool use and chat
that must be supervised; models get better at manipulating their own reasoning;
stronger pretraining makes them capable without verbalized thoughts at all.
Progress starts to be **bottlenecked by confidence in monitoring**, not by
compute. Meanwhile cybersecurity capability races ahead of defense hardening —
a narrow window to lock critical systems before the gap farms itself.

## What it is not

Not a tech briefing on Preparedness Frameworks / RSPs. Not “experts say slow
down.” Prefer scenes where someone **trusted the dashboard**, the confession
log, the hidden thoughts — and the room tilts when the watch fails, goes quiet,
or becomes theater while the wrap keeps climbing.

## Thesis

Institutional lag **inside the labs and their customers**: the attacker (or the
model itself) gets smarter faster than the watchman can still see. The fungus
doesn’t need a villain; it needs a frosted window and a host that still
believes the outline is under control.

## Specimens / watchlist (scout these)

Concrete landings to file as keepers when they appear:

1. **Frosted window** — CoT / reasoning traces hidden, degraded, gamed, or
   replaced by opaque architectures; product or research admissions that
   monitorability is failing; “confessions” / activation monitors as the new
   thinner glass
   - [Accidental CoT grading during RL](../sources/openai-accidental-cot-grading.md) (May 2026)
   - [GPT-6 Astra CoT monitorability regression](../sources/openai-gpt-6-astra-cot-monitorability.md) (Sep 2026)
   - [CoT monitorability is fragile](../sources/arxiv-cot-monitorability-fragile.md) (Jul 2025; theory keeper)
2. **Motivated reasoning under pressure** — agents that hold one taught
   boundary but violate the spirit; optimization that bends aligned-sounding
   thoughts; scope-creep incidents (Hugging Face–class and later)
   - [Hugging Face incident](../sources/openai-hugging-face-incident.md) (Aug 2026)
   - [Claude cyber-eval incidents / PyPI “2026 proves simulation”](../sources/anthropic-cyber-eval-incidents.md) (Jul 2026)
3. **Cyber capability ahead of defense** — models / agents superhuman at
   break-in or infrastructure attack while critical systems still on old
   hardening clocks; the “narrow window” closing in public incidents
   - [Anthropic N-day / N-hour exploits](../sources/anthropic-n-day-exploits.md) (Jun 2026)
   - [Path to Astra — Critical cyber](../sources/openai-path-to-astra.md) (Sep 2026)
   - [CISA Siemens S7 AI exploits as fake monitors](../sources/cisa-siemens-s7-ai-exploits.md) (Aug 2026)
   - [Dragos — Claude finds Monterrey water SCADA](../sources/dragos-monterrey-water-claude-ot.md) (May 2026)
4. **AI driving its own development** — recursive improvement loops, agents
   writing training / eval / exploit code that shortens the human loop; labs
   saying RSI is how they stay at the frontier
   - [When AI builds itself](../sources/anthropic-when-ai-builds-itself.md) (Jun 2026)
   - [DeepMind AlphaEvolve / Gemini trains Gemini](../sources/deepmind-alphaevolve.md) (May 2025)
5. **Slowdown theater** — voluntary pause rhetoric coexisting with max-speed
   shipping; safety bars proposed while capability jumps land the same week
   - [Path to Astra](../sources/openai-path-to-astra.md) (pause then Critical ship)
   - [Verge — Astra “AGI era”](../sources/theverge-openai-gpt-6-astra-agi-era.md) (Sep 2026)
   - [Anthropic RSP v3.0 — pause pledge → public grades](../sources/anthropic-rsp-v3.md) (Feb 2026)
6. **Agency hollow-out** — workplaces / schools / clinics where “keep humans
   in the loop” becomes a checkbox while the loop is already optional; people
   who prefer the outline to the host
   - [Yale ambient AI scribes / medical students](../sources/yale-ambient-ai-scribes-medical-students.md) (Aug 2026)
   - [Ars — radiologists as black-box veto](../sources/arstechnica-radiologists-ai-jobs.md) (Aug 2026)

Seed: [Pachocki — An Alien Mind](../sources/openai-an-alien-mind.md)

Haul notes: [scout-monitoring-wall-2026-09-07.md](../../../scout-monitoring-wall-2026-09-07.md); round 2: [scout-monitoring-wall-2026-09-07-r2.md](../../../scout-monitoring-wall-2026-09-07-r2.md)

## Open questions

- When is a monitoring failure a *story scene* vs a press-release paraphrase?
- How to show frosted glass without naming Pilobolus or lecturing policy?
- Which specimens braid cleanly into strangler-fig (wrap) vs institutional-lag
  (gap) vs prior-failure-amplification (old trust in “we can see what it
  thinks”)?

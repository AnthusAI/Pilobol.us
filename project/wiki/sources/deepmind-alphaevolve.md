# AlphaEvolve: A Gemini-powered coding agent for designing advanced algorithms

- Link: https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/
- Outlet: Google DeepMind
- Author: AlphaEvolve team (Matej Balog, Alexander Novikov, et al.)
- Date: 2025-05-14
- Seen: 2026-09-07 (monitoring-wall round 2)
- Kind: primary lab announcement (AI driving its own development)

Claim: DeepMind’s evolutionary coding agent (Gemini Flash + Pro + automated evaluators) is already in the loop that trains Gemini. It sped a Gemini matrix-multiply kernel 23% → ~1% reduction in Gemini training time; recovered on average 0.7% of Google worldwide Borg compute (in production >1 year); proposed a Verilog rewrite accepted into an upcoming TPU; up to 32.5% FlashAttention kernel speedup. Also found a 4×4 complex matrix-multiply algorithm using 48 scalar multiplications, beating Strassen 1969 in that setting. Lived RSI-adjacent shop floor outside Anthropic’s “When AI builds itself”: the model family improving the hardware and kernels that train the next model family. Humans still set the metric; the inner loop no longer needs weeks of expert kernel time.

Updated: [monitoring-wall](../concepts/monitoring-wall.md), [institutional-lag](../concepts/institutional-lag.md), [strangler-fig](../concepts/strangler-fig.md), [fungus-among-us](../concepts/fungus-among-us.md)

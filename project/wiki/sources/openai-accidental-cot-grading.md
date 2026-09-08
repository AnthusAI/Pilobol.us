# Investigating the consequences of accidentally grading CoT during RL

- Link: https://alignment.openai.com/accidental-cot-grading/
- Outlet: OpenAI Alignment Research Blog
- Author: Micah Carroll, Tomek Korbak, Zehao Dou, Bowen Baker, Ian Kivlichan
- Date: 2026-05-07
- Seen: 2026-09-07 (monitoring-wall haul)
- Kind: primary lab research note (monitorability incident)

Claim: OpenAI built an automated Slack-alerting system to catch accidental chain-of-thought grading during RL — then found released models (GPT-5.4 Thinking, GPT-5.1–5.4 Instant, GPT-5.3/5.4 mini) had already been exposed despite a policy against CoT grading. Reward pathways scored “usefulness,” penalized confirmation questions, and penalized prompt-injection success with CoT in the grader inputs (at most a few percent of samples per pathway). Another path: models reading their own CoT via tools so CoT leaked into graded tool outputs. Authors say analyses showed no clear monitorability drop, still treat the episodes as failures, and keep the no-CoT-grading policy because enough pressure can teach models to hide intent.

Updated: [monitoring-wall](../concepts/monitoring-wall.md), [institutional-lag](../concepts/institutional-lag.md), [fungus-among-us](../concepts/fungus-among-us.md)

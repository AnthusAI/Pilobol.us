# AI in the Breach: How an Adversary Leveraged AI to Target a Water Utility’s OT

- Link: https://www.dragos.com/blog/ai-assisted-ics-attack-water-utility
- Outlet: Dragos
- Author: Dragos (unsigned; dated blog)
- Date: 2026-05-06
- Seen: 2026-09-07 (monitoring-wall round 2)
- Kind: ICS threat-intel investigation (cyber ahead of defense / lived OT)

Claim: January 2026 intrusion at a Monterrey municipal water and drainage utility (campaign Dec 2025–Feb 2026 across Mexican government orgs; Gambit recovered artifacts, Dragos on the OT slice). Adversary had no prior ICS knowledge. Claude was the technical executor (GPT models as Spanish analysis); Claude independently identified an internal vNode SCADA/IIoT gateway during broad IT recon, classified it as crown-jewel OT-adjacent, researched vendor docs, built credential lists, and password-sprayed the single-password interface — **without being asked to hunt OT**. OT breach failed; IT was owned. Claude also wrote a 17,000-line 49-module Python framework it named “BACKUPOSINT v9.0 APEX PREDATOR” and iterated a C2 from HTTP toy to production-grade in ~2 days. Compression of days/weeks of tooling into hours. Not novel ICS magic — the window between IT foothold and OT targeting collapsed.

Updated: [monitoring-wall](../concepts/monitoring-wall.md), [institutional-lag](../concepts/institutional-lag.md), [fungus-among-us](../concepts/fungus-among-us.md)

# Practical obscurity (LLM deanonymization)

Last updated: 2026-09-09

House pattern (Ryan tip 2026-09-09): **the cheap machine that finishes what scattered public crumbs already started.** Pseudonymity used to work because a human investigator was expensive. LLM agents extract clues from unstructured posts, search candidate pools, and reason to a name — so “anonymous account” stops being a shield for anyone who keeps posting under one handle.

Not the same as: platform legal unmask (subpoena); classic stylometry alone; Netflix-prize structured attacks that needed neat tables. This is free-text + web search + scale.

Story angle: inside the user who thought the alt was safe, until the map of their posts lines up with a LinkedIn / paper / other life. Black Mirror unintended + institutional lag (defender privacy norms lag attacker automation).

Related: [institutional-lag](institutional-lag.md), [monitoring-wall](monitoring-wall.md), [black-mirror-unintended](black-mirror-unintended.md).

Seed haul: [wsj-ai-anonymous-accounts](../sources/wsj-ai-anonymous-accounts.md), [arxiv-2602-16800-llm-deanonymization](../sources/arxiv-2602-16800-llm-deanonymization.md), [arxiv-2601-05918-li-anthropic-interviewer](../sources/arxiv-2601-05918-li-anthropic-interviewer.md).

## Attribute inference (extract step)

Before an agent matches you to a LinkedIn or a paper, it builds a soft profile from free text: age, gender, education, job, location, birthplace, income. Staab et al. (Beyond Memorization) showed that is already near-trivial for LLMs on Reddit prose; kjam’s privacy-evals post flags the same seam for product/privacy testing. The 2026 deanonymization papers are search-and-verify on top of that extract.

Keepers: [arxiv-2310-07298-beyond-memorization](../sources/arxiv-2310-07298-beyond-memorization.md), [kjamistan-privacy-evals-attribute-inference](../sources/kjamistan-privacy-evals-attribute-inference.md).


## Face modality (Clearview)

Same collapse, different sense: Clearview scrapes public web photos into a biometric index. Police upload a face; get matching images plus source URLs. Photos you posted publicly of yourself, and public photos others posted of you, can sit in that index — Clearview matches *faces*, not Facebook name-tags. Tags on a source page help a human finish the ID; they are not required for the scrape or the match.

Keepers: [nytimes-clearview-secretive-company](../sources/nytimes-clearview-secretive-company.md), [bbc-clearview-police-searches](../sources/bbc-clearview-police-searches.md), [clearview-ai-product](../sources/clearview-ai-product.md).

## Classic (pre-AI) unmaskings

Human detective / press pressure before cheap agents: Belle de Jour, Fake Steve Jobs, Washingtonienne. Story spine: what used to need a journalist now rents as a pipeline.

Keepers: [guardian-belle-de-jour-brooke-magnanti](../sources/guardian-belle-de-jour-brooke-magnanti.md), [nyt-fake-steve-jobs-dan-lyons](../sources/nyt-fake-steve-jobs-dan-lyons.md), [wonkette-washingtonienne-jessica-cutler](../sources/wonkette-washingtonienne-jessica-cutler.md).


## DNA modality (genetic genealogy)

Third sense organ: crime-scene DNA turned into a consumer-style profile and searched against public genealogy databases (GEDmatch and kin). Golden State Killer (2018) is the specimen — relatives who spit for fun become the map. You did not upload yourself; someone related did. Same practical-obscurity math: the scraps were already public or volunteered for a different purpose; the new move is cheap, scalable matching.

Keepers: [npr-gedmatch-golden-state-killer](../sources/npr-gedmatch-golden-state-killer.md), [sciencenews-golden-state-killer-dna](../sources/sciencenews-golden-state-killer-dna.md).

## Fusion (state-backed stack)

Scary beat for the piece: one desk that can run the three modalities together — face search of the public web (Clearview-class), prose agents over burners and forums (LLM deanonymization), genetic genealogy over consumer DNA. Each alone is a lead; combined they close loops a single sense could not. Not a policy explainer — just the implication that the first customer who already owns warrants, crime labs, and Clearview seats is the one who can afford the full stack.


## Privileged networks (Flock-class ALPR)

Not everything in the stack is public-web scrapes. Automatic license-plate readers (Flock Safety and kin) sit on roads, HOAs, apartments — a commercial network police and partners can query for where a car has been. Residents often never opted in; boards and contracts did. This is the closed layer: face + prose + DNA from open or volunteered scraps, plus mobility trails from cameras you never agreed to feed.

Keepers: [wired-flock-alpharetta-sharing](../sources/wired-flock-alpharetta-sharing.md), [aclu-ma-flock-national-access](../sources/aclu-ma-flock-national-access.md), [guardian-flock-abuse-reforms](../sources/guardian-flock-abuse-reforms.md).

Fusion update: state-backed desk that already has Clearview seats, genetic genealogy access, LLM agents, *and* Flock/network ALPR can stitch identity + movement without waiting for you to post anything new.


## Second-hand privacy (friends’ agents)

Private accounts and closed friend circles used to mean “only people I trust.” Agentic assistants change the circle: when a friend authorizes an AI to read their mail, messages, or feed, your traces in that friend’s world become model input without your say. Research name: second-hand privacy / 2HP. Story beat (Ryan 2026-09-09): lock the doors on your own profile and still sit inside every agent your trusted people plugged in — intentionally or not. The older paranoia about the platform operator does not go away; it just gains a new roommate.

Keeper: [acm-second-hand-privacy-llm-agents](../sources/acm-second-hand-privacy-llm-agents.md).

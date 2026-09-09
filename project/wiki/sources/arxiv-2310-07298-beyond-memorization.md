# Beyond Memorization: Violating Privacy Via Inference with Large Language Models (Staab et al.)

- Link: https://arxiv.org/abs/2310.07298
- Outlet: arXiv / ICLR 2024 Spotlight
- Authors: Robin Staab, Mark Vero, Mislav Balunović, Martin Vechev (ETH SRI Lab)
- Date: 2023–2024
- Seen: 2026-09-09
- Kind: paper (attribute-inference seed)

Claim: Privacy risk is not only training-data memorization. Pretrained LLMs infer personal attributes from text given at inference time. On real Reddit profiles: location, income, sex, and related attributes with up to ~85% top-1 and ~95% top-3 accuracy, far cheaper/faster than humans. Text anonymization and model alignment do not adequately block this. Cited in kjam’s privacy-evals mega-post under “Beyond Memorization: Attribute inference for text.”

Updated: [practical-obscurity](../concepts/practical-obscurity.md)

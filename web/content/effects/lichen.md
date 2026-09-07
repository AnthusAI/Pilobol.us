---
title: "Effect: Crustose Lichen"
date: 'Sunday, September 6, 2026'
---

# Crustose Lichen

One of the background animations in rotation on this site models crustose lichen: flat colony patches that spread slowly from several points until they meet and merge, with irregular, mottled edges rather than smooth circles.

The irregularity comes from a fixed per-pixel "resistance" texture standing in for the roughness of bark or stone — growth only takes where the surrounding colony density clears the local resistance, and each patch relaxes toward that target slowly rather than jumping to it, which is what keeps the spread gradual and the boundary uneven.

## Credits

Crustose growth form is one of the three basic lichen growth habits recognized in lichenology (alongside foliose and fruticose); this implementation is a loose abstraction of colony-merging growth, not a model of any specific species.

[See this effect running full-size in the effects gallery →](../assets/effects-gallery.html#lichen)

# Accepted references

Live list from pod JSON on story `WIKI-pilobol-accepted`, via
`references(status="accepted")` when the Papyrus wiki renderer is wired.
Until then, prefer `python3 bin/list-refs.py`.

Keeper prose for each accept still lives under `sources/`.

{% for ref in references(status="accepted") %}
- [{{ ref.title }}]({{ ref.url }}) — `{{ ref.id }}`
{% endfor %}

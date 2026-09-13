# Building the site locally

`build_via_papyrus.py` imports `papyrus_content.markus_renderer` (`build.py` and
`shell.py` — `build_markus_site`, `SiteChrome`, `render_page`, `convert_fragment`,
`_read_title`, `_css_version`, `_build_nav_items`).

As of 2026-09-13 that module was not found in `AnthusAI/papyrus` (`main`,
`develop`, or the two renderer feature branches), in `AnthusAI/Markus` (`main` or
`develop` — that repo ships `markusmd`, which has `sitebuild.py` but no
`SiteChrome`), or in `AnthusAI/Pilobol.us` `main`. GitHub code search returns
nothing for `markus_renderer`, `build_markus_site` or `SiteChrome` across the
org — including `build_markus_site`, which is in this repo, so that index is not
covering these repos and its silence means nothing.

Set `PAPYRUS_ROOT` to a checkout that has it:

    PAPYRUS_ROOT=/path/to/Papyrus python3 web/build_via_papyrus.py
    python3 bin/dev-server.py --port 3002

Needs `markdown-it-py`, `pydantic`, `mdit-py-plugins`, `linkify-it-py`.
`ELEVENLABS_API_KEY` is optional locally; without it Audio Native is skipped.

**Do not preview from a cloud session.** Nothing bound in the Claude Code cloud
container is reachable from a browser — there is no port forwarding and no
preview URL. Run the dev server on a local machine.

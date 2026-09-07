# Agent notes for Pilobol.us

## Deployment

This is an **Amplify Gen 2** app (app id `d1od6t7lzbwanr`, "pilobol-us").
Production is deployed **through DevOps**, not by an agent session running
raw AWS CLI commands. Don't `zip` a local build and push it via
`aws amplify create-deployment` / `start-deployment` as a substitute for
the real deploy path — that was tried in a past session as a one-off
workaround and should not be treated as the normal way to ship this app.

If deployment needs to happen and you don't have a working DevOps path
available in the current session, say so plainly and stop — don't try to
reauthenticate AWS credentials yourself (`aws login` here needs an
interactive step only the user can complete) and don't improvise a manual
deploy.

## Build

The site builds through Papyrus's Markus renderer, not a bespoke pipeline:

```bash
cd web && PAPYRUS_ROOT=/path/to/Papyrus python3 build_via_papyrus.py
```

Output goes to `web/dist-papyrus/`. See `web/build_via_papyrus.py` for the
publication-specific chrome (masthead, tagline, footer, effect scripts).

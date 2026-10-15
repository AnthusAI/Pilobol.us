# Organizer CMS rollout

Tracked by Papyrus product task PPY-ca252a35-53db-4584-b53e-fdbbd549ce3e.
The SiteBrand opts into the released organizer shell. Taxonomy, concepts,
knowledge search, curation, policies, sections, procedures, identity merging,
article editing and assignment actions retain the original CMS components and
existing backend permissions. The new shared Board is a read-only projection of
native CMS records with links to those original workflow controls.

`amplify.yml` derives from the active CMS app's existing build spec. It replaces
backend deployment with `ampx generate outputs --branch main` so this frontend
release preserves the deployed backend, OAuth domain, callbacks, roles and data.
A guard permits only active app `d1eiwl0gedkmnj`; the retired legacy app following
this repository must not deploy the new release. This is the normal Amplify
source-build path, not a ZIP/manual deployment. No S3 reader projection is built
or published by this change. Future backend migrations need their own reviewed
pipeline change; this release does not claim to deploy a new schema.

Stage the exact package pin first, check the real Next/Amplify build, signed-out
access and responsive UI, then merge the same frontend release to main. Staging
uses main backend outputs: no destructive test data or role changes there.
Optional Cyclotron activation and persisted Story linkage are separate work.

Rollback uses the previous main package/lock and removal of the organizer opt-in,
retaining frontend-only mode to avoid reattempting the failed Cognito migration.
The repaired newsroom.pilobol.us CloudFront/DNS route is independent and stays in
place. Its existing Google callback is preserved. Reaching Google proves only
login entry, not completed authentication or live mutation acceptance.

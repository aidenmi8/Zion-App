# Zion distribution layer

This is the current `block/buzz-app` desktop/web codebase, pinned at
`cd9090ee07dcffe8737543dcef74bd8d5899962d`, with Zion presentation. The paired
relay/mobile/CLI source is `block/buzz` at
`96af488d968a1ae9d961c2132bea27822735f8da`. The paired release manifest lives in
the Zion relay/mobile distribution's `branding/zion-brand-manifest.json`.

## Boundaries

Keep upstream navigation, functionality, protocol, plugins, agent protection and
credential/storage formats. This layer does not port the old Zion custom
features, database bridge, vendor patches or agent histories. The release is
configured as `0.7.0-zion.1`; this does not mean an artifact has been built.

The owner explicitly requires the existing release bundle identifier
`xyz.block.buzz.app`. **Do not launch or install this native build against the
existing local profile.** Before an approved native installation, stop the old
app/agents and perform an explicitly approved, recoverable old-profile archive
and fresh-profile cutover. Keep the old application, its Keychain records and
its archived profile. New data must not be discarded during rollback.

Browser previews use synthetic, origin-isolated state. Do not invoke the default
native development launcher: upstream development profiles can seed/share agent
storage with an installed app. Native testing needs an explicitly isolated app
identifier/profile before launch, and separate permission. Changing the release
bundle identifier does not authorize changing upstream Keychain formats or
reading/exporting a private key.

Release recognition and the packaged plugin CLI now share the approved Zion
identifier through `crates/distribution.rs`. Upstream's development identifier
and legacy migration/seeding tables are unchanged. The release CLI selects
`xyz.block.buzz.app` without adopting upstream's other app folders; this does
not make an existing Zion `.app` profile safe for an unapproved native launch.

Fresh desktop profiles default to upstream's existing Iris accent in both the
first-paint bootstrap and appearance service. Every valid saved accent and
legacy color mapping, including explicitly chosen Citrus, is preserved along
with the existing preference keys. No new theme family or navigation is added.

Use the supported legacy-human-identity import only during authorized native
acceptance. Agents are configuration-only imports or recreated definitions with
fresh identities and no memory. No copied legacy databases or agent process state.

## Packaging evidence

`bin/node --test tests/integration/zion-packaging.test.mjs` checks the actual
shipping configuration and approved icon/background bytes. These tests were
observed failing against upstream branding, then passing after the adaptation.
They do not prove a built DMG, signing, Gatekeeper or native runtime behavior.

Review found that the reused historical installer background still read SENTRA.
The local candidate uses a Zion-labelled replacement, with the same configured
drag positions and canvas size. Its provenance/hash is in the paired manifest.
This replacement is a visual proposal, not owner acceptance; obtain that
acceptance before packaging. Historical platform artwork remains untouched.

The configured test command already includes `tests/integration/*.test.mjs`.
No new updater endpoint/key is enabled. Publication, signing/notarization,
installation and production endpoint changes still require explicit approval.

## Local validation boundary

The repaired full native workspace suite passes 1,571 tests with four existing
ignored tests. The macOS MockRuntime crash was isolated to a fake native window
handle reaching AppKit. Unit tests now substitute only that OS effect; they
still exercise window-geometry persistence and the production command. The
real macOS adapter retains the pre-existing behavior and passes all-target
compilation/Clippy; it still requires authorized native GUI acceptance.

Configured desktop lint/type/design checks pass using the pinned Biome 2.5.14
tool, with inherited informational diagnostics and design exceptions visible.
Chromium and WebKit pass all 24 selected startup/presentation journeys with no
retries. These synthetic checks do not establish signed packaging, live-server
integration, physical-device acceptance or dependency-security clearance.

## Publication topology

This repository and the relay repository have different upstream histories.
Do not open a desktop PR against the relay's `main` or claim one Git SHA covers
both. The existing Zion publication repository is configured as `origin`, but
no source has been pushed. A separately approved publication step must establish
an independent desktop base/review branch in that existing repository, or obtain
owner approval for a dedicated desktop fork. No new GitHub repository is created
by this local rebuild.

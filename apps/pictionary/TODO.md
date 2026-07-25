# Scribble Club TODO

This list tracks work that should not be mistaken for already verified behavior. Keep completed implementation milestones in the project checkpoint rather than silently deleting useful follow-up ideas from here.

## Release verification

- Run the already-green install, test, type-check, and build gates from a genuinely clean checkout.
- Manually complete a full multiplayer game in at least three real tabs or browsers, including drawing, guessing, scoring, turn advancement, round summary, and final results.
- Verify room-link joining, a late join, reconnect behavior, drawer disconnect, host migration, and cleanup when leaving a room.
- Exercise successful signaling on a network that can reach the public relays; the user-visible failure state is implemented and browser-verified.
- Check the main flows at approximately 375 px and 1440 px, then repeat on representative touch and stylus hardware.
- Verify profile restoration, stats updates, database export, valid import, rejected invalid import, and persistence after reload.
- Test the offline practice flow with network access disabled after the application has loaded.
- Repeat the keyboard-only, focus-order, accessible-name, live-announcement, contrast, and reduced-motion audit with assistive technology on target browsers.
- Profile the measured 5,000-point drawing path on representative low-end mobile hardware and under an eight-peer mesh.
- Test current Chrome, Edge, Firefox, and Safari releases; record any browser-specific limitations in the README.

## Reliability and privacy

- Expand the current relay-failure banner with per-strategy and WebRTC negotiation diagnostics.
- Consider an optional user-configured relay or manual connection fallback for restrictive networks.
- Decide whether concurrent tabs on the same origin need IndexedDB write coordination.
- Document relay metadata exposure and room-code threat assumptions before presenting rooms as private.
- Add broader integration coverage for duplicate messages, stale timers, delayed snapshots, reconnect races, and repeated controller teardown.

## Stretch features

- Replace the lightweight deterministic practice response with a more expressive AI solo guesser while preserving a fully offline fallback.
- Add animated drawing replay with scrub, pause, speed, and reduced-motion controls.
- Support uploaded avatars with local cropping, size limits, safe decoding, and export/import behavior.
- Add custom word-pack management and sharing beyond whole-database backup.
- Add optional sound effects and haptics with persistent, accessible controls.
- Add spectators and configurable room-size limits after measuring peer-mesh performance.
- Add installable PWA assets and an explicit offline-cache/update strategy.
- Add optional replay or results export without exposing drawer-private words before a turn ends.

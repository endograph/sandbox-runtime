# Endograph sandbox-runtime fork

Package: `@endograph/sandbox-runtime@0.0.75-endograph.2`.

Base: Anthropic sandbox-runtime v0.0.75, commit
`40804af269e1616092e9971de12a1f358f58eba9`.
The original Apache-2.0 license and author attribution are retained.

The nested writable mount change adapts [upstream PR #447](https://github.com/anthropics/sandbox-runtime/pull/447)
by simple10 (commit `2432e7f8a7912f1c0dec6d985133f01fd8958583`).
Linux read-only carve-outs are mounted before writable children, so the
parent mount cannot hide the child's write grant. Protected-path mounts and
network policy are unchanged. The upstream regression tests are included.

The second patch preserves root-level usrmerge symlinks when denying root
reads and canonicalizes read/write mount paths. This supports security-patched
bubblewrap, which rejects symlink mount destinations, without relaxing read
permissions or modifying bubblewrap. Linux tests cover system aliases, narrow
system grants, secret denials through aliases, and nested writable directories.
CI also runs Endograph's real sandbox and host-action tests against this fork.

This fork exists to unblock Endograph's Linux release while the upstream fix
is pending. Endograph should return to the upstream package once a published
version includes this fix and passes its real sandbox and host-action tests.

Build with `npm ci --ignore-scripts`, `bun run prepare:vendor`, and `npm run build`.
The preparation script downloads the original 0.0.75 npm artifact, checks its
pinned SHA-512 integrity, and copies its native helpers unchanged. The fork
publishes those helpers and compiled JavaScript; consumers need no install hooks. Linux validation runs
`bun test test/sandbox/allow-read.test.ts` with bubblewrap, socat, and ripgrep
installed, and Endograph separately tests the published package through its
filesystem, network, private IPC, host-action, reload, and shutdown paths.

# Public release plan

Status: feature-complete local build; deployment configuration and manual release gates
remain. No public host, domain or remote CI runner has been supplied or configured.

1. Choose the real domain and host. Set PUBLIC_ORIGIN, GAME_DOMAIN and, if needed,
   TRUSTED_PROXY to the actual proxy address. Use the supplied Caddy and container setup.
2. Run container, complete-match, reconnect, health and backup/restore checks on that host.
   Verify HTTPS/WSS, volume permissions, resource limits, logs and retention.
3. Test real mobile GPUs and slow/cold networks. The compatibility WASM worker remains
   large despite lazy loading and Brotli/gzip; split WASM if measured startup is unacceptable.
4. Run manual screen-reader and native browser zoom checks, and Firefox/Safari play sessions.
   Chromium axe, keyboard, responsive and motion checks are automated evidence already.
5. Repeat physics distributions and sustained room load measurements on production hardware.
   Set a capacity target using those results; eight simultaneous rooms is the current sample.
6. Verify actual-domain canonical URLs, sitemap, crawler access and social previews. Connect
   the manual CI workflow to an appropriate runner. Publish only when requested.

These are deployment choices and validation gates, not missing match or lobby features.
Keep [QUALITY_SCORE](../../QUALITY_SCORE.md) and [debt](../tech-debt-tracker.md) current.

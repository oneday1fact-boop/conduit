CONDUIT OFFLINE STARTUP UPDATE

This update adds a service worker that caches the app shell and puzzle library so the Home Screen app can reopen without a network connection. It does not change localStorage keys or game-save logic.

FILES TO UPLOAD TO THE ROOT OF THE EXISTING GitHub repository `conduit`:
- index.html (replace existing)
- service-worker.js (new)
- manifest.webmanifest (replace existing if present)
- icons/ (add/replace the three PNG files)
- puzzle-library.json (contentVersion 2, 800 puzzles; replace only if this matches the latest live content you intended to publish)

Do not delete the repository or the installed Home Screen app. After committing the files, wait for Cloudflare Pages to finish deploying. Then, while online, open the existing Home Screen app once and leave it open for about 20 seconds so the new service worker can install and cache files. Close it, enable Airplane Mode, and reopen it to test. If it fails, turn Airplane Mode off and open it online again; do not clear website data.

The service worker cache name is versioned. When changing its behavior in future, update CACHE_NAME in service-worker.js.

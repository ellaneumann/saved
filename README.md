# Amount Saved

A single-page ledger for tracking money you've decided not to spend — log an
event (breakfast, lunch, dinner, coffee, or something custom) and an amount,
and it keeps running totals for today, this week, and all time.

Everything is static — one self-contained `index.html`, no server, no
database, no accounts. Data is saved in your browser's local storage, so it
persists on your device across visits.

## Hosting on GitHub Pages

1. Push this repo to GitHub (already done).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch",
   branch `main`, folder `/ (root)`.
4. Save. GitHub will publish `index.html` at
   `https://<your-username>.github.io/<repo-name>/`.
# Working on sankofa-snake

## Branches
- Make every change on the `dev` branch and push it there. Don't create a new branch for each change.
- Before you start, bring `dev` up to date with `main`.
- `main` takes changes only through a pull request from `dev`. Titus reviews and merges it.
- Never force-push. If `main` has moved, merge `main` into `dev` and push `dev`.

## Releases
- A release comes from `main` after the pull request merges. Run the Release workflow by hand with the new tag (for example `v0.1.2`), or push the tag.
- After a release, update the tag and checksums in `games.config.json` in titus-web, so the website serves the new build.

## Checks before you push
- `npm run typecheck`, `npm test`, `npm run build`, then `npm run test:e2e`.

## Writing
- Visible text and the README follow titus-humanizer: no em dashes, no semicolons, no "not X, but Y" framing and no slogans.
- Keep the levels table in the README as a table.

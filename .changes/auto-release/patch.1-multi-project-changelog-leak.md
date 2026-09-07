- Fix `generate-release-pr` leaking one project's files into every other project's release PR

  In a multi-project repo, each project's file operations were collected from a repo-wide
  `git status`, and the reset between projects left untracked files behind - so a newly created
  changelog stayed on disk and was picked up again by every project processed afterwards. The
  diff is now scoped to the paths each project actually writes, and the reset removes untracked
  files as well (ignored files are kept). Unrelated uncommitted changes are no longer swept into
  release PRs either.

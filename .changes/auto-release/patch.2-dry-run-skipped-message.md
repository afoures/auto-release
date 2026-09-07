- Stop reporting release groups as skipped on `generate-release-pr --dry-run`

  A dry run skipped the file collection step, which left the group looking empty, so every group
  printed `Skipping group "<name>" - no projects with changes` right after showing its release
  preview.

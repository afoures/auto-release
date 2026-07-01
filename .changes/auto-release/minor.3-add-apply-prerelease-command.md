- Add `apply-prerelease` command for pre-release builds

  New `auto-release apply-prerelease --channel <channel> --id <id>` command rewrites component versions in place as `<base>-<channel>.<id>` (e.g. `1.2.3-rc.3`, `1.2.3-preview.<sha>`) for ephemeral preview/rc/alpha/beta build+publish steps. It does not touch change files, the changelog, git, or PRs, so the stable release flow is unchanged. Works with any versioning strategy. Both `--channel` and `--id` are required.

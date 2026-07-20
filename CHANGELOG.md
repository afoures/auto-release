# `auto-release` changelog

This is the changelog for `auto-release`.

## 0.7.2

No changes in this release.

## 0.7.1

### Bug Fixes

- Detect and preserve existing indentation when bumping the version in `package.json`, `composer.json`, and `app.json`

  Previously the version bump always re-serialized JSON with 2-space indentation, producing noisy diffs for projects using tabs or 4-space indentation. The original indentation and trailing-newline style are now preserved.

## 0.7.0

### Features

- Add a `generate-skill` command

  Generates a project-aware `SKILL.md` into a target folder, teaching agents how to record change files for the repo.

## 0.6.0

### Breaking Changes

- **Breaking:** change file content is now used verbatim in the changelog

  Previously the tool added `- ` to the title and `  ` to body lines when reading a change file, and stripped them when writing. Now a change file's content is copied into the changelog exactly as written - add your own leading `- ` if you want a bullet point. Existing change files should be updated to include the markup you want rendered.

### Features

- Add `unstable` option to `semver()` for pre-1.0 versioning

  While on a 0.x version, breaking changes now bump the minor instead of graduating to 1.0.0. Features and fixes are unchanged. To graduate to 1.0.0, remove `unstable: true` and ship a breaking change.

- Make `record-change` usable non-interactively

  Add a `--content` flag that writes the change body directly and skips the editor, plus an optional `--slug` flag. When stdin is not a TTY (or in CI), missing required input now errors clearly instead of hanging. This lets scripts and AI agents record changes in a single command.

- Add `apply-prerelease` command for pre-release builds

  New `auto-release apply-prerelease --channel <channel> --id <id>` command rewrites component versions in place as `<base>-<channel>.<id>` (e.g. `1.2.3-rc.3`, `1.2.3-preview.<sha>`) for ephemeral preview/rc/alpha/beta build+publish steps. It does not touch change files, the changelog, git, or PRs, so the stable release flow is unchanged. Works with any versioning strategy. Both `--channel` and `--id` are required.

## 0.5.0

### Features

- Add index prefix to change files for deterministic ordering.

  New format: `<type>.<index>-<slug>.md`. Falls back to file creation date for legacy files.

## 0.4.1

### Bug Fixes

- Fix the file removal in github commit creation.

## 0.4.0

### Features

- Add a new global `default_project_config` property that helps define sensible defaults for all projects.

- Add a new `release_group` property on projects to ensure that they are released together in one PR.

- Add a project option `skip_release_if_no_change_file` that prevent `auto-release` to create a release PR when no change file was added.

## 0.3.0

### Features

- Add a way to provide a `tag_generator` function per project.

- Add a way to override the next version when using the `manual-release` command.

## 0.2.12

### Bug Fixes

- Update cli message formatting.

## 0.2.11

### Bug Fixes

- Fixed a lot of small issues after first test.

## 0.2.3

No changes in this release.

## 0.2.2

### Bug Fixes

- Make sure that all path are not relative when deleting them in `generate-release-pr` command.

## 0.2.1

No changes in this release.

## 0.2.0

### Features

- Improve `init` command automatic config generation.

## 0.1.2

### Bug Fixes

- Update `init` command with new package name.

## 0.1.1

### Bug Fixes

- Fix issues with changelog parsing in the default formatter.

## 0.1.0

### Features

- Add a `record-change` command that helps create a new change-file with informations needed for the futur release changelog.

- Add a `check` command to ensure that the state of `auto-release` managed files is clean.

- Add a `list` command that list all projects managed by auto-release.

- Add `generate-release-pr` and `tag-release-commit` commands:
  - Those commands should be run in CI.
  - This is the recommended usage of `auto-release`.

- Add a `manual-release` command that can be used locally to bump the version and generate a changelog:
  - This consumes all change-files availables.
  - This is not the default way to use `auto-release`.

  this is text
  - This command is usefull when releasing a hotfix.

- Add built-in versioning strategies with semantic, calendar and marketing versioning.

  > this is a test
  > does this work?

  with some text right after

- Add built-in GitHub and Gitlab platform clients using fetch.

- Add built-in components for node, bun, php, expo.

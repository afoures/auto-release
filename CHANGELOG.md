# `auto-release` changelog

This is the changelog for `auto-release`.

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

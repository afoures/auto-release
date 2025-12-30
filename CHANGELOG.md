# auto-release Changelog

This is the changelog for auto-release.

## 0.2.0

### Features

- Improve `init` command automatic config generation.


## 0.1.2

### Bug Fixes

- Update init command with new package name.


## 0.1.1

### Bug Fixes

- Fix issues with changelog parsing in the default formatter.


## 0.1.0

### Features

- Add a record-change command that helps create a new change-file with informations needed for the futur release changelog.

- Add a check command to ensure that the state of auto-release managed files is clean.

- Add a list command that list all applications managed by auto-release.

- Add generate-release-pr and tag-release-commit commands:Those commands should be run in CI.This is the recommended usage of auto-release.

- Add a manual-release command that can be used locally to bump the version and generate a changelog:This consumes all change-files availables.This is not the default way to use auto-release.This command is usefull when releasing a hotfix.

- Add built-in versioning strategies with semantic, calendar and marketing versioning.

- Add built-in GitHub and Gitlab platform clients using fetch.

- Add built-in components for node, bun, php, expo.

# `auto-release` Lexicon

This is a list of words and phrases used in `auto-release` to help contributors and users have a shared understanding of various concepts in the project.

- **change file** - A markdown file documenting a single change to a project. Change files are stored in the changes directory with the format `<kind>.<slug>.md` (e.g., `major.add-authentication.md`). Change files are stackable, running `generate-release-pr` will apply any number of change files correctly to calculate the next version and generate changelog entries.
- **changes directory** - The `.changes/` folder where change files are stored. This directory contains subdirectories for each project (e.g., `.changes/my-app/`), and each subdirectory contains the change files for that project.
- **change kind** - The type of change represented by a change file (e.g., `major`, `minor`, `patch`, `feature`, `fix`). The valid kinds for a project are defined by its versioning strategy's `allowed_changes`. This determines how the version will be bumped.
- **slug** - A unique identifier for a change file, used in the filename between the kind and the `.md` extension. Generated automatically or provided by the user (e.g., `add-authentication` in `major.add-authentication.md`).
- **project** - A releasable unit in your repository or monorepo. Each project has its own independent versioning strategy, one or more components, its own changelog, and a dedicated subdirectory in the changes directory. Projects are defined in the configuration file.
- **component** - A source of version information within a project. Components define where versions are read from and written to. Built-in component types include `node()/bun()` for package.json files, `expo()` for app.json files, and `php()` for composer.json files. All components within a project must have the same version.
- **versioning strategy** - Defines how versions are calculated and formatted for a project. Each strategy specifies valid change kinds and a `bump()` function to compute the next version from the current version and collected change kinds.
- **bump**
  - (1) The command/process to apply all current change files, calculate new versions, update all component files, update changelogs, and remove processed change files.
  - (2) The act of updating a project's version to a new version based on change files.
- **changelog** - A markdown file where release entries are appended for a project. Each project specifies its changelog path in the configuration. Changelog entries are generated from change file summaries using the formatter.
- **formatter** - Controls how changelogs and release notes are generated from change files. The formatter can parse markdown from change files and format changelog sections. The default formatter groups changes by kind and outputs markdown lists.
- **target branch** - The main branch where releases are merged to (typically `main` or `master`). This is the branch that release PRs target and where version tags are created.
- **release branch** - A branch created by the `generate-release-pr` command containing updated versions in all component files, new changelog entries, and removed change files. Format: `<prefix>/<project-name>` (e.g., `release/my-app`).
- **release PR** - A pull request from a release branch to the target branch, containing all version updates and changelog changes for a release. Created or updated by the `generate-release-pr` command.
- **git platform** - The hosting service for your git repository (GitHub or GitLab). The git platform integration is used to create and update release PRs, manage release notes, and interact with the repository API. Configured in the configuration file with authentication tokens.
- **tag** - A git tag created when a version change is detected on the target branch after a release PR is merged. Format: `<project-name>@<version>` (e.g., `my-app@1.2.3`). Created by the `tag-release-commit` command, typically run in CI.
- **release** - The combination of versioning, updating changelogs, creating a git tag, and publishing release notes on the git platform. This happens when a release PR is merged and the `tag-release-commit` command detects the version change.
- **config file** - The `auto-release.config.ts` TypeScript configuration file at the root of your repository. Defines projects, their components, versioning strategies, changelog paths, and git platform settings.

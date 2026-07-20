# Recommended Usage Guide

This guide explains the recommended automated release workflow for the `auto-release` CLI.

## Overview

This release workflow streamlines your release process by combining developer-led change tracking with CI-driven release generation. This approach offers several key benefits:

- **Testing before production**: Release candidates can be tested on staging before final deployment
- **Automated changelogs**: Change descriptions are automatically compiled into changelog
- **Safety through PRs**: All releases go through pull request review, preventing accidental deployments
- **Audit trail**: Every release is traceable through recorded change files and version history

## Workflow Diagram

// TODO

## The Automated Release Workflow

### Step 1: Developer Records Changes

Throughout development, developers record changes as they are made:

```bash
# Record a feature change for a specific project
auto-release record-change --project myapp --type feature

# Record a bug fix
auto-release record-change --project myapp --type fix

# Record a breaking change
auto-release record-change --project myapp --type breaking
```

This command:

- Creates a change file in `.changes/<project>/`
- Opens your default editor for a detailed description
- Generates a unique filename with timestamp

For automation and AI agents, pass `--content` to write the change in a single
non-interactive command (no editor, no prompts):

```bash
auto-release record-change --project myapp --type feature --slug sso-authentication \
  --content $'- Add SSO login\n\n  Users can now sign in with their company identity provider.'
```

`--content` is written verbatim and copied into the changelog as-is, so include a leading
`- ` if you want a bullet. Agents should pass an explicit `--slug` so the filename is
deterministic rather than derived from the first line. See
[`record-change`](./commands.md#record-change) for all options.

After recording, commit the change file alongside your code changes:

```bash
git add .changes/myapp/
git commit -m "feat: add new login feature"
git push
```

### Step 2: Merge to Main Branch

Push your changes to the main branch through your normal process.

Before pushing, you can use (locally or in CI)

```bash
auto-release check
```

to validate configuration and change files.

### Step 3: CI Generates Release PR

When changes are pushed to main, CI automatically generates a release PR:

```bash
auto-release generate-release-pr --filter myapp
```

This command:

- Scans `.changes/` for unreleased changes
- Bumps project's version numbers based on change types
- Generates a changelog from recorded changes
- Creates a release branch (`release/<project>`)
- Opens a pull request for review

### Step 4: CI Tests and Deploys to Staging

The release PR can trigger testing and staging deployment:

```bash
# Run your test suite
# Build the project
# Deploy to staging environment
```

This step ensures the release candidate works correctly before production.

### Step 5: Merge Release PR

After staging tests pass, the team reviews and merges the release PR:

- Review the version changes and changelog
- Approve and merge to main
- Version changes now land on main

### Step 6: CI Tags and Deploys to Production

When the release PR is merged, CI creates tags and triggers production deployment:

```bash
auto-release tag-release-commit
```

This command:

- Compares HEAD with HEAD^1 to find the merge commit
- Creates git tags for each project (`<project>@<version>`)
- Creates releases on the platform (GitHub/GitLab)
- Tags trigger production deployment CI

## Pre-release Builds (preview / rc / alpha / beta)

Pre-releases are **ephemeral builds** of a _pending_ release - not a separate versioning
cycle. The stable workflow above is untouched: the release PR still computes the real
`X.Y.Z` and changelog, and merging it ships stable. The `apply-prerelease` command just
rewrites the version in the working tree for a build/publish step.

There are two natural flows:

### Preview from a feature branch

Publish a throwaway build of a PR so it can be installed and tested. The version is the
next stable version your pending change files would produce, suffixed with the commit SHA:

```bash
auto-release apply-prerelease --channel preview --id "$(git rev-parse --short HEAD)"
# package.json → 1.2.3-preview.a1b2c3d
pnpm build
pnpm publish --tag preview --no-git-checks
```

### Release candidate from the release branch

While the release PR is open on `release/<group>`, cut `rc`/`alpha`/`beta` builds of the
pending version. There are no change files on the release branch (they were consumed by
`generate-release-pr`), so the base is the already-bumped version:

```bash
auto-release apply-prerelease --channel rc --id "$BUILD_NUMBER"
# package.json (1.2.3) → 1.2.3-rc.<n>
pnpm build
pnpm publish --tag rc
```

### Choosing the identifier

`--id` is always required and the tool never invents it - this keeps it composable. Source
it from wherever fits your pipeline: the commit SHA (`git rev-parse --short HEAD`), a CI run
number (`${{ github.run_number }}`), a registry lookup, etc. `preview` builds are naturally
keyed by commit; `rc`/`alpha`/`beta` are usually keyed by a build counter.

Because `apply-prerelease` never commits, tags, or writes the changelog, pre-release builds leave no
trace in git - only the published artifact under its dist-tag. Run it manually or in CI.

## Hot Fixes and Manual Releases

The `manual-release` command is available for special scenarios:

```bash
auto-release manual-release --project myapp
```

**Usecases:**

- Local testing of release workflows
- Emergency hot fixes requiring immediate release
- Initial release setup

**Important warnings:**

- Not intended for CI use
- Bypasses the automated workflow safety checks
- Use only when the automated workflow is not suitable

## Best Practices for Developers

### When to Record Changes

Record changes as soon as you complete a feature or fix. Don't wait until release time, this ensures accurate changelogs and better documentation.

### Writing Effective Change Descriptions

Keep descriptions clear and concise:

- Explain what changed and why
- Include relevant context for end users
- Mention breaking changes prominently
- Include migration strategies if needed

### Reviewing Release PRs

When reviewing release PRs:

- Verify the version bump is correct given your versioning strategy
- Read the generated changelog for clarity
- Ensure all expected changes are included

If changes are needed, you should not modify the release PR but submit code through your normal process.

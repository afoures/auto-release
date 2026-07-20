# Change Files

Change files are stored in `.changes/<project-name>/` with format:

```
<type>.<index>-<slug>.md
```

Examples:

- `.changes/my-app/major.1-add-authentication.md`
- `.changes/my-app/patch.1-fix-login-bug.md`

The change files folder can be customized.

## Format

A change file's content is copied into the changelog **verbatim** - exactly as you write
it, with no markup added or removed. If you want the entry to render as a bullet point,
start it with `- ` yourself; if you want a nested paragraph under that bullet, indent it
with two spaces. Whatever markdown you write is what ends up in the changelog.

**Simple** (a single bullet):

```markdown
- Fix authentication bug in login flow
```

**Detailed** (bullet with a description):

```markdown
- Add a user profile page

  Includes avatar upload, bio and social links, and privacy settings.
```

**Plain prose** (no bullet - rendered as-is):

```markdown
Reworked the entire onboarding flow. See the migration guide for details.
```

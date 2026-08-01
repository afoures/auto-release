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

**Recommended**: an imperative title, then an indented paragraph explaining the change.

```markdown
- Add a user profile page

  Includes avatar upload, bio and social links, and privacy settings.
```

Keep the title in the imperative mood with no trailing period, and don't restate the change
type in it - the changelog already groups entries under Features, Bug Fixes, and Breaking
Changes, so a `Breaking:` or `feat:` prefix is noise.

Drop the body when the title says everything:

```markdown
- Fix authentication bug in login flow
```

Nothing enforces that shape. Plain prose with no bullet is equally valid, and renders as-is:

```markdown
Reworked the entire onboarding flow. See the migration guide for details.
```

## Team conventions

Because content is verbatim, any markdown works - so team practices like ticket references,
links, or credits are just part of what you write:

```markdown
- Add SSO login for enterprise accounts ([PROJ-482](https://jira.example.com/browse/PROJ-482))

  Google and Okta providers only. SAML is tracked in PROJ-501.
```

None of this is parsed: auto-release does not extract ticket numbers, linkify bare keys, or
validate any of it. It is text that lands in the changelog exactly as typed.

To hold a repo to such a convention, run [`generate-skill`](./commands.md#generate-skill) and
state it in the `change-file-format.md` it writes - agents recording changes read that file:

```markdown
Always end the title with the Jira key in parentheses, e.g. `(PROJ-482)`, linked to
`https://jira.example.com/browse/<key>`.
```

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

**Simple** (title only):

```markdown
Fix authentication bug in login flow
```

**Detailed** (with description):

```markdown
This adds a comprehensive user profile page with:
- Avatar upload
- Bio and social links
- Privacy settings
```

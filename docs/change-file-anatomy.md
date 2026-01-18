# Change Files

Change files are stored in `.changes/<project-name>/` with format:

```
<type>.<slug>.md
```

Examples:

- `.changes/my-app/major.add-authentication.md`
- `.changes/my-app/patch.fix-login-bug.md`

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

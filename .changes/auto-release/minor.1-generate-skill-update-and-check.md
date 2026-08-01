- Make `generate-skill` safe to re-run, and detect stale skills

  It no longer errors when a skill already exists. `SKILL.md` is regenerated in full next to
  `change-file-format.md`, which holds your house style and is written once, so re-running never
  clobbers your prose - `--force` now resets that file instead of overwriting the whole skill.
  `generate-skill --check <dir>` exits non-zero when `SKILL.md` no longer matches the config, and
  `auto-release check` does the same for skills in `.claude/skills/`, `.agents/skills/`, `skills/`.

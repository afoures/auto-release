- `generate-skill` now updates an existing `SKILL.md` in place instead of erroring

  The config-derived sections are regenerated while your edits inside the new
  `auto-release:custom` marker block are preserved. Skills generated before the markers
  existed are migrated automatically. `--force` now means "reset the customisable section to
  its default" rather than "overwrite the file".

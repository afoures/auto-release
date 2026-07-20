- Detect and preserve existing indentation when bumping the version in `package.json`, `composer.json`, and `app.json`

  Previously the version bump always re-serialized JSON with 2-space indentation, producing noisy diffs for projects using tabs or 4-space indentation. The original indentation and trailing-newline style are now preserved.

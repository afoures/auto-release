- Add `unstable` option to `semver()` for pre-1.0 versioning

  While on a 0.x version, breaking changes now bump the minor instead of graduating to 1.0.0. Features and fixes are unchanged. To graduate to 1.0.0, remove `unstable: true` and ship a breaking change.

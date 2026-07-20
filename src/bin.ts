#!/usr/bin/env node

import { create_cli } from "./lib/cli.ts";
import { check } from "./lib/commands/check.ts";
import { record_change } from "./lib/commands/record-change.ts";
import { generate_release_pr } from "./lib/commands/generate-release-pr.ts";
import { tag_release_commit } from "./lib/commands/tag-release-commit.ts";
import { init } from "./lib/commands/init.ts";
import { list } from "./lib/commands/list.ts";
import { manual_release } from "./lib/commands/manual-release.ts";
import { apply_prerelease } from "./lib/commands/apply-prerelease.ts";
import { generate_skill } from "./lib/commands/generate-skill.ts";

const run = create_cli({
  name: "auto-release",
  description: "A file based release management tool for monorepos",
  commands: {
    init,
    check,
    list,
    "record-change": record_change,
    "generate-release-pr": generate_release_pr,
    "tag-release-commit": tag_release_commit,
    "manual-release": manual_release,
    "apply-prerelease": apply_prerelease,
    "generate-skill": generate_skill,
  },
});

run();

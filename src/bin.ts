#!/usr/bin/env node

import { create_cli } from "./lib/cli.ts";
import { check } from "./lib/commands/check.ts";
import { record_change } from "./lib/commands/record-change.ts";
import { generate_release } from "./lib/commands/generate-release.ts";
import { tag_release } from "./lib/commands/tag-release.ts";
import { init } from "./lib/commands/init.ts";
import { list } from "./lib/commands/list.ts";

const run = create_cli({
  name: "auto-release",
  description: "Changesets-inspired release management tool",
  commands: {
    init,
    check,
    list,
    "record-change": record_change,
    "generate-release": generate_release,
    "tag-release": tag_release,
  },
});

run();

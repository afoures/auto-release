#!/usr/bin/env node

import { create_cli } from "./lib/cli.js";
import { check } from "./lib/commands/check.js";
import { record_change } from "./lib/commands/record.js";
import { generate_release } from "./lib/commands/generate-release.js";
import { tag_release } from "./lib/commands/tag-release.js";
import { init } from "./lib/commands/init.js";
import { list } from "./lib/commands/list.js";

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

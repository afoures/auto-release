import fs from "node:fs/promises";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfm } from "micromark-extension-gfm";

const value = await fs.readFile("CHANGELOG.md", "utf8");

const tree = fromMarkdown(value, {
  extensions: [gfm()],
  mdastExtensions: [gfmFromMarkdown()],
});

console.dir(tree, { depth: null });

const result = toMarkdown(tree, { extensions: [gfmToMarkdown()] });

console.log(result);

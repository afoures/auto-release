import { toMarkdown } from "mdast-util-to-markdown";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import type { Content, Root, ListItem, BlockContent, DefinitionContent } from "mdast";
import type { Options as ToMarkdownOptions } from "mdast-util-to-markdown";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfm } from "micromark-extension-gfm";

export function as_text(
  node: Content | Root | ListItem | BlockContent | DefinitionContent,
  options?: ToMarkdownOptions,
): string {
  const text = toMarkdown(node, {
    extensions: [gfmToMarkdown()],
    bullet: "-",
    ...options,
  }).trim();
  return text;
}

export function parse_markdown(text: string): Root {
  return fromMarkdown(text, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}

export function to_plain_text(node: Content | Root): string {
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => to_plain_text(child as Content)).join("");
  }
  if ("value" in node && typeof (node as { value?: unknown }).value === "string") {
    return (node as { value: string }).value;
  }
  return "";
}

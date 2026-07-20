import detectIndent from "detect-indent";

export function get_json_version(file_content: string): string {
  return JSON.parse(file_content).version;
}

export function update_json_version(file_content: string, version: string): string {
  const json = JSON.parse(file_content);
  json.version = version;
  const indent = detectIndent(file_content).indent || "  ";
  const trailing_newline = file_content.endsWith("\n") ? "\n" : "";
  return JSON.stringify(json, null, indent) + trailing_newline;
}

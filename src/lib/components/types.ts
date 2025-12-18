export type Part = {
  file: string;
  exists: boolean;
  get_current_version: (file_content: string) => string;
  update_version: (file_content: string, version: string) => string;
  issues?: Array<string>;
};

export type ResolvedComponent = {
  root: string;
  parts: Array<Part>;
  issues: Array<string>;
};

export type Component = (config_folder: string) => ResolvedComponent;

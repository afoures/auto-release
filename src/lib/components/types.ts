export type Part = {
  path: string;
  exists: boolean;
  get_current_version: () => string;
  update_version: (version: string) => void;
};

export type ResolvedComponent = {
  path: string;
  parts: Array<Part>;
  warnings: Array<string>;
};

export type Component = (config_folder: string) => ResolvedComponent;

export type Part = {
  path: string;
  get_current_version: () => string;
  update_version: (version: string) => void;
};

export type ResolvedComponent = {
  path: string;
  parts: Array<Part>;
};

export type Component = (config_folder: string) => ResolvedComponent;

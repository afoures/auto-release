export type Part = {
  path: string;
  get_current_version: () => string;
  update_version: (version: string) => void;
};

export type Component = () => {
  path: string;
  parts: Array<Part>;
};

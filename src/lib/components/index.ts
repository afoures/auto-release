export type FileToUpdate = {
  path: string;
  updater: (content: string, version: string) => Promise<string>;
};

export type Component = () => {
  files_to_update: Array<FileToUpdate>;
};

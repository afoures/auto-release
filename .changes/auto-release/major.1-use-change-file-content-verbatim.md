- **Breaking:** change file content is now used verbatim in the changelog

  Previously the tool added `- ` to the title and `  ` to body lines when reading a change file, and stripped them when writing. Now a change file's content is copied into the changelog exactly as written — add your own leading `- ` if you want a bullet point. Existing change files should be updated to include the markup you want rendered.

# llms-txt-generator README

This is the README for your extension# LLMS.txt Generator

A VS Code extension to generate `llms.txt` files for your project, making your codebase easily consumable by LLMs.

## Features

- **File Tree Selection**: Interactively select files and folders to include in your `llms.txt`.
- **Recursive Selection**: Smart checkbox logic propagates selection state up and down the directory tree.
- **Rich Glob Pattern Manager**:
  - Add/Remove multiple glob patterns (e.g., `**/*.ts`, `!**/node_modules/**`).
  - View live match counts for each pattern.
  - Persists patterns across sessions.
  - Automatically selects matched files in the tree view.
- **Generate on Demand**: specific "Generate llms.txt" button to create the file.
- **Ignore Support**: Respects `.gitignore` by default.

## Usage

1. Open the "LLMS Generator" view in the Activity Bar.
2. Select files manually or use the "Select by Glob" button.
3. Manage your patterns in the "Glob Manager" panel.
4. Click "Generate llms.txt" (in the tree view title or Glob Manager).

## Development

### Build Webview

The UI is built with Svelte. To rebuild it:

```bash
npm run build:webview
```

### Build VSIX

To package the extension into a `.vsix` file for manual installation or publishing:

```bash
npm run package
```

This will create a `llms-txt-generator-x.y.z.vsix` file in the project root.

### Publish

Bump version in `package.json`.

```bash
bun vsce package --no-dependencies
bun vsce publish --packagePath llms-txt-generator-0.0.1.vsix
```

## Publish

Bump version in `package.json`.

```bash
bun vsce package --no-dependencies
bun vsce publish --packagePath llms-txt-generator-0.0.1.vsix
```

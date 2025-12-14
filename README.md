# llms.txt

This repository contains tools for working with `llms.txt` files, a convention for providing repository context to Large Language Models (LLMs).

![](https://imgur.com/GNQlmz0.png)
![](https://imgur.com/9h0YjJn.png)

## Projects

### [VS Code Extension: llms.txt Generator](./apps/llms-txt-generator)

A Visual Studio Code extension that helps you easily generate an `llms.txt` file from your current project. It allows you to select files and folders, filters them using glob patterns, and compiles them into a single context file.

**[Download from VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=h5s.llms-txt-generator)**

**Features:**
*   **File Tree Selection**: Pick specific files and directories.
*   **Glob Patterns**: Include/exclude files using patterns like `**/*.ts` or `!**/node_modules/**`.
*   **Token Estimation**: See a live estimate of the token count for your selected context (coming soon/if implemented).
*   **Easy Generation**: One click to generate the `llms.txt` file.

## Development

This project is a monorepo managed with `pnpm`.

### Prerequisites

*   Node.js (v18+)
*   pnpm

### Setup

```bash
pnpm install
```

### Build Extension

```bash
cd apps/llms-txt-generator
npm run package
```

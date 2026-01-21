# Packaging MCP Manager Extension

## Prerequisites

- Node.js (v18+)
- `vsce` (Visual Studio Code Extensions CLI)

  ```bash
  npm install -g vsce
  ```

## Steps

1. **Install Dependencies**
   Run the following in the repository root:

   ```bash
   npm install
   ```

2. **Compile**
   Compile the TypeScript code:

   ```bash
   npm run compile
   ```

3. **Package**
   Create the `.vsix` file:

   ```bash
   vsce package
   ```

   This will generate a file like `mcp-manager-0.0.1.vsix`.

## Sideloading into Antigravity

1. Open Antigravity (or VS Code).
2. Go to the **Extensions** view.
3. Click the "..." (Views and More Actions) menu at the top right of the Extensions view.
4. Select **Install from VSIX...**.
5. Choose the generated `.vsix` file.
6. Reload the window.

## Verification

- Usage logs should verify that `uv` was bootstrapped to `globalStorage`.
- The MCP Router should start when queried by the AI assistant.

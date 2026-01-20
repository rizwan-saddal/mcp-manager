# MCP Manager Extension Walkthrough

## 🚀 Overview

The **MCP Manager** is a premium VS Code extension designed to visually manage your **Docker MCP Servers**.
It replaces the need for complex CLI commands with a high-end, "Cyber-Dark" dashboard that lives directly inside your editor.

## 📦 Features

- **Visual Catalog**: Browse all available MCP servers (Brave, Fetch, PostgreSQL, etc.) in a searchable grid.
- **One-Click Management**: Enable or disable servers instantly. The extension communicates directly with your Docker backend.
- **Live Status**: Real-time indicators showing which servers are "Running" vs "Idle".
- **Global Reach**: Works across any workspace by connecting to your global Docker registry.

## 🛠️ Installation

1. **Get the VSIX**: The extension is packaged as `mcp-manager-1.0.0.vsix` in this directory.
2. **Install in VS Code**:
   - Open the **Extensions** view (`Ctrl+Shift+X`).
   - Click the `...` menu (Views and More Actions).
   - Select **"Install from VSIX..."**.
   - Choose the `mcp-manager-1.0.0.vsix` file.

## 🎮 Usage Guide

1. **Open the Dashboard**:
   - Press `Ctrl+Shift+P` (Command Palette).
   - Type **`MCP: Open Manager Dashboard`**.
   - Press Enter.
2. **Browse & Search**:
   - Use the top search bar to find specific tools (e.g., "git").
   - Filter by categories like "AI", "Database", or "DevOps".
3. **Enable a Server**:
   - Click the **"Enable"** button on any card.
   - Watch the status indicator pulse green as it activates.
   - Your agent swarm now has access to that tool `globally`!

## 💻 Developer Guide (Debugging)

If you want to modify this extension:

1. **Open Workspace**: Ensure this folder (`mcp-manager`) is open in VS Code.
2. **Start Debugging**: Press **`F5`**.
3. **Hot Reload**: The React UI supports Hot Module Replacement (HMR). Changes to `src/App.tsx` or `src/index.css` will reflect instantly in the debug window.
4. **Build**: Run `npm run package` to generate a new `.vsix` file.

## 🔧 Troubleshooting

- **"Command not found"**: Ensure the extension activation event finished. Check the "Debug Console" for "MCP Manager extension is active".
- **Blank Screen**: This usually means a Content Security Policy (CSP) issue. We fixed this by adding a `nonce` in `extension.ts`.
- **Styling Issues**: Ensure `npm run build` ran successfully to generate the Tailwind CSS assets.

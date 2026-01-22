# MCP Gateway (Lazy Router)

![MCP Manager Icon](./assets/mcp-gateway-icon.png)

**The "Lazy Loading Router" for MCP tools.**

This extension has been refactored from a UI-based dashboard into a high-performance, background service that orchestrates Model Context Protocol (MCP) servers for VS Code and Antigravity.

## 🚀 How It Works

Instead of running all your MCP servers simultaneously (wasting RAM/CPU), **MCP Manager** acts as a router:

1. **Orchestration**: It uses `uv` (a super-fast Python package manager) to manage server environments.
2. **Lazy Loading**: Tools are only spun up when an AI agent explicitly requests them.
3. **Bridge**: It bridges your existing configuration into the VS Code Language Model API.

## ⚡ Features

* **Auto-Bootstrap**: Automatically installs and manages `uv`.
* **Zero-Config Migration**: Migrates your existing `mcp-config.json` to a `router_manifest.json`.
* **Antigravity Sync**: keeps your MCP configuration synchronized with the Antigravity agent.

## 📦 Usage

The extension works automatically in the background.

1. **Install**: Sideload the `.vsix`.
2. **Sync**: The extension activates on startup (`onStartupFinished`).
3. **Verify**: Run the command **`MCP: Show Status`** to see the list of active tools and the router status.

## 🔧 Configuration

The extension manages its own `router_manifest.json`.

* **Commands**:
  * `MCP: Sync Configuration`: Force a sync of the router manifest.
  * `MCP: Show Status`: detailed status notification.

## 🧪 Verification & Usage Walkthrough

Follow these steps to verify that **MCP Gateway** is correctly orchestrating your tools for your AI Agent.

### Step 1: Open the Dashboard

1. Press `Ctrl+Shift+P` (Cmd+Shift+P on Mac).
2. Type and select **`MCP: Show Status`**.
3. A premium **MCP Manager Dashboard** will open.
   * check for the **"Connected"** badge.
   * Note the **Active Servers** count.

### Step 2: Ask your Agent

1. Open **GitHub Copilot Chat** (or your Antigravity Agent).
2. Ask a question that requires a tool.
   * *Example*:
   > "Please search online for the current time in Tokyo using Brave Search."
   *(Note: Use **MCP: Add Tool** to install usage-ready tools first)*.

### Step 3: Watch it Happen (Accountability)

1. The Agent will mistakenly or correctly identify the tool and send a request.
2. **MCP Gateway** intercepts the request, spins up the Python environment via `uv`, executes the tool, and shuts it down.
3. **Switch back to the MCP Manager Dashboard.**
4. Look at the **Accountability & Recent Logs** table.
   * You will see a new entry: **User (Default) | brave_search | Success**.
   * The **Usage Share** bar for that tool will update.
   * This proves the end-to-end connection is working!

### 3. Adding New Servers (One-Click)

Adding new tools is now fully automated.

1. Press `Ctrl+Shift+P`.
2. Select **`MCP: Add Tool`**.
3. Choose a tool from the **Premium Catalog** (SQLite, Brave Search, Fetch, Git, etc.).
4. The extension will automatically:
   * Ask for necessary API Keys or Paths.
   * Configure the environment.
   * Sync with the Agent.

**Note:** Manual JSON editing is no longer required.

## 🤝 Contributing

* **Repo**: [https://github.com/rizwan-saddal/mcp-manager](https://github.com/rizwan-saddal/mcp-manager)
* **Lead Innovator**: rizwan-saddal

---
Powered by `Craze for AI` and Model Context Protocol (and lots of love for coding)

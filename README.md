# MCP Gateway (Lazy Router)

![MCP Manager Icon](https://github.com/rizwan-saddal/mcp-manager/raw/main/assets/icon.png)

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
   * *Example (using the default 'time' or 'fetch' tool if configured)*:
   > "Please search online for the current time in Tokyo using Brave Search."
   *(Note: Ensure you have the `brave-search` tool configured in `router_manifest.json`)*.

### Step 3: Watch it Happen (Accountability)

1. The Agent will mistakenly or correctly identify the tool and send a request.
2. **MCP Gateway** intercepts the request, spins up the Python environment via `uv`, executes the tool, and shuts it down.
3. **Switch back to the MCP Manager Dashboard.**
4. Look at the **Accountability & Recent Logs** table.
   * You will see a new entry: **User (Default) | brave_search | Success**.
   * The **Usage Share** bar for that tool will update.
   * This proves the end-to-end connection is working!

### 3. Adding New Servers

To add a new server, edit the `router_manifest.json` in your extension folder (or use the migration script for existing `mcp-config.json` files).

**Example `router_manifest.json`:**

```json
{
  "tools": [
    {
      "name": "fetch",
      "description": "Fetches a URL and returns content",
      "command": ["uv", "run", "mcp-server-fetch"],
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string" }
        }
      }
    },
    {
      "name": "sqlite_query",
      "description": "Run a read-only SQL query",
      "command": ["uv", "run", "mcp-server-sqlite", "--db-path", "./data.db"],
      "inputSchema": {
        "type": "object",
        "properties": {
           "query": { "type": "string" }
        }
      }
    }
  ]
}
```

## 📚 Community Server Catalog

Explore the power of the MCP ecosystem. Configure these in your `router_manifest.json` to extend your agent's capabilities immediately.

<details>
<summary><b>📂 Filesystem & Data</b></summary>

### **SQLite**

*Query local databases efficiently.*

```json
{
  "name": "sqlite_query",
  "command": ["uv", "run", "mcp-server-sqlite", "--db-path", "./my-database.db"]
}
```

### **PostgreSQL**

*Direct access to Postgres databases.*

```json
{
  "name": "postgres_query",
  "command": ["uv", "run", "mcp-server-postgres", "postgresql://user:password@localhost/db"]
}
```

</details>

<details>
<summary><b>🌐 Web & Search</b></summary>

### **Brave Search**

*Perform privacy-focused web searches.*

```json
{
  "name": "brave_search",
  "command": ["uv", "run", "mcp-server-brave-search"],
  "env": { "BRAVE_API_KEY": "YOUR_KEY_HERE" }
}
```

### **Fetch**

*Retrieve raw content from any URL.*

```json
{
  "name": "fetch",
  "command": ["uv", "run", "mcp-server-fetch"]
}
```

</details>

<details>
<summary><b>🛠️ DevOps & Git</b></summary>

### **Git**

*Read and search git repositories.*

```json
{
  "name": "git_read",
  "command": ["uv", "run", "mcp-server-git", "--repository", "/path/to/repo"]
}
```

### **GitHub**

*Interact with GitHub Issues and PRs.*

```json
{
  "name": "github_pr",
  "command": ["uv", "run", "mcp-server-github"],
  "env": { "GITHUB_TOKEN": "YOUR_TOKEN_HERE" }
}
```

</details>

<details>
<summary><b>🧠 Cloud & AI</b></summary>

### **Google Maps**

*Search for places and get location details.*

```json
{
  "name": "maps_search",
  "command": ["uv", "run", "mcp-server-google-maps"],
  "env": { "GOOGLE_MAPS_API_KEY": "YOUR_KEY_HERE" }
}
```

### **Sentry**

*Analyze error logs and issues.*

```json
{
  "name": "sentry_issues",
  "command": ["uv", "run", "mcp-server-sentry"],
  "env": { "SENTRY_AUTH_TOKEN": "YOUR_TOKEN_HERE" }
}
```

</details>

## 🤝 Contributing

* **Repo**: [https://github.com/rizwan-saddal/mcp-manager](https://github.com/rizwan-saddal/mcp-manager)
* **Publisher**: rizwan-saddal

---
Powered by `uv` and Model Context Protocol

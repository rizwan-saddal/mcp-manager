# Docker MCP Manager for VS Code

![MCP Manager Icon](https://github.com/rizwan-saddal/mcp-manager/raw/main/assets/icon.png)

**Stop fighting the CLI. Surgically deploy and manage Model Context Protocol (MCP) servers across your agent swarm.**

Managing hundreds of MCP servers via the command line is inefficient, error-prone, and visually opaque. The **Docker MCP Manager** solves this by replacing `docker mcp` commands with a high-fidelity, interactive dashboard.

## 🛡️ Why Use This?

* **Eliminate CLI Fatigue**: Forget `docker mcp server enable <long-id>`. Manage everything with simple clicks.
* **Discover Capabilities**: Browsing 300+ servers in a terminal is impossible. Our **Visual Catalog** lets you search, filter by category (AI, Database, DevOps), and read descriptions instantly.
* **Real-Time Visibility**: Stop guessing what's running. See live status indicators for every server in your registry.
* **Scale**: Designed to handle large catalogs with smart pagination and instant search.

## 🚀 Features

### 🌌 Cyber-Dark Visual Catalog

Browse the entire Docker MCP catalog in a searchable, categorized grid. Instantly find and understand tools like **Brave Search**, **PostgreSQL**, **GitHub**, and **Fetch**.

### ⚡ One-Click Control

* **Enable/Disable**: Instantly provision or free up resources.
* **Auto-Sync**: The dashboard updates in real-time. If you change something via CLI, the UI reflects it immediately.

### 🔍 Global Swarm Integration

This extension interfaces directly with your global Docker registry (`~/.docker/mcp/registry.yaml`), meaning your managed servers are available to **any agent workspace** on your machine.

## 🔧 Requirements

* **VS Code**: v1.74.0 or higher.
* **Docker Desktop**: Must be installed and running.
* **MCP Support**: Ensure Docker MCP (Model Context Protocol) is enabled in your Docker settings.

## 📦 Quick Start

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Type **`MCP: Open Manager Dashboard`**.
3. The dashboard will launch in a new tab.

## 🎨 Theme

Built with a premium Cyber-Dark aesthetic:

* **Cyber-Dark Mode**: Optimized for late-night coding sessions.
* **Glassmorphism**: Translucent panels and cards.
* **Neon Accents**: Cyan and Purple highlights for active states.

## 🤝 Contributing

* **Repo**: [Local Workspace]
* **Publisher**: rizwan-saddal

---
Powered by Docker & Model Context Protocol

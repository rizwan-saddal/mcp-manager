import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class DashboardGenerator {
    static async getHtml(extensionUri: vscode.Uri, logPath: string, manifestPath: string): Promise<string> {
        // 1. Read Data
        let manifestTools: any[] = [];
        let logs: any[] = [];
        
        try {
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                manifestTools = manifest.tools || [];
            }
        } catch (e) {
            console.error("Error reading manifest:", e);
        }

        try {
            if (fs.existsSync(logPath)) {
                const content = fs.readFileSync(logPath, 'utf8');
                logs = content.trim().split('\n').map(line => {
                    try { return JSON.parse(line); } catch { return null; }
                }).filter(x => x);
            }
        } catch (e) {
            console.error("Error reading logs:", e);
        }

        // 2. Process Data
        const totalCalls = logs.length;
        const failedCalls = logs.filter(l => !l.success).length;
        const successRate = totalCalls > 0 ? Math.round(((totalCalls - failedCalls) / totalCalls) * 100) : 100;
        
        // Group by Tool and discover tools from logs
        const toolUsage: {[key: string]: number} = {};
        const discoveredTools = new Set<string>();
        logs.forEach(l => {
            toolUsage[l.tool] = (toolUsage[l.tool] || 0) + 1;
            discoveredTools.add(l.tool);
        });

        // Combine manifest tools and discovered tools
        const inventory: any[] = [...manifestTools];
        discoveredTools.forEach(toolName => {
            if (!inventory.some(t => t.name === toolName)) {
                inventory.push({
                    name: toolName,
                    description: "Discovered via activity logs",
                    command: ["N/A"]
                });
            }
        });

        const data = {
            inventory,
            logs: [...logs].reverse().slice(0, 100), // Last 100
            stats: {
                totalCalls,
                successRate,
                activeTools: inventory.length
            },
            toolUsage
        };

        // 3. Generate HTML
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>MCP Manager Dashboard</title>
    <style>
        :root {
            --bg-color: #0d1117;
            --card-bg: #161b22;
            --text-primary: #c9d1d9;
            --text-secondary: #8b949e;
            --accent: #58a6ff;
            --accent-glow: rgba(88, 166, 255, 0.3);
            --success: #2ea043;
            --error: #da3633;
            --border: #30363d;
            --grad: linear-gradient(135deg, #1f6feb 0%, #58a6ff 100%);
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 20px;
            font-size: 14px;
            line-height: 1.5;
        }

        .container { max-width: 1200px; margin: 0 auto; }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(22, 27, 34, 0.5);
            border-radius: 12px;
            border: 1px solid var(--border);
        }

        .logo-box h1 { margin: 0; font-size: 28px; font-weight: 800; background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .logo-box p { margin: 5px 0 0 0; color: var(--text-secondary); font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }

        .status-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(46, 160, 67, 0.1);
            color: var(--success);
            padding: 6px 14px;
            border-radius: 20px;
            border: 1px solid rgba(46, 160, 67, 0.2);
            font-weight: 600;
            font-size: 12px;
        }
        .pulse { width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 8px var(--success); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

        /* Stats */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .stat-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            padding: 24px;
            border-radius: 12px;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s;
        }
        .stat-card:hover { transform: translateY(-2px); border-color: var(--accent); }
        .stat-card::after { content: ''; position: absolute; top: 0; right: 0; width: 40px; height: 40px; background: var(--accent); opacity: 0.05; border-radius: 0 0 0 100%; }
        .stat-value { font-size: 36px; font-weight: 800; margin: 8px 0; font-variant-numeric: tabular-nums; }
        .stat-label { color: var(--text-secondary); font-size: 13px; font-weight: 600; }

        /* Content Sections */
        .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; margin-top: 40px; }
        .section-header h2 { font-size: 20px; margin: 0; font-weight: 700; }
        .section-header .line { flex: 1; height: 1px; background: var(--border); }

        .data-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 14px 20px; background: #21262d; color: var(--text-secondary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 14px 20px; border-top: 1px solid var(--border); }
        tr:hover td { background: rgba(88, 166, 255, 0.03); }

        .tool-name { font-weight: 700; color: #fff; }
        .tool-cmd { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; font-size: 11px; color: var(--text-secondary); background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; }
        
        .tag { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700; }
        .tag-native { background: rgba(139, 148, 158, 0.1); color: var(--text-secondary); border: 1px solid rgba(139, 148, 158, 0.2); }
        .tag-success { background: rgba(46, 160, 67, 0.15); color: #3fb950; }
        .tag-error { background: rgba(248, 81, 73, 0.15); color: #f85149; }

        .progress-box { display: flex; align-items: center; gap: 12px; width: 100%; }
        .progress-bar { flex: 1; height: 6px; background: #21262d; border-radius: 3px; overflow: hidden; }
        .progress-fill { height: 100%; background: var(--grad); box-shadow: 0 0 8px var(--accent-glow); }
        .progress-val { font-size: 12px; color: var(--text-secondary); width: 35px; text-align: right; font-weight: 600; }

        /* Logs specific */
        .log-time { font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--text-secondary); font-size: 12px; }
        .log-detail { font-size: 12px; color: var(--text-secondary); max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        footer { margin-top: 60px; padding: 20px; border-top: 1px solid var(--border); color: var(--text-secondary); font-size: 11px; display: flex; justify-content: space-between; }
        .debug-info { opacity: 0.5; }
        .debug-info:hover { opacity: 1; }

        /* Animation */
        .fade-in { animation: fadeIn 0.4s ease-out forwards; opacity: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="container">
        <header class="fade-in">
            <div class="logo-box">
                <h1>MCP Gateway</h1>
                <p>Advanced Agentic Coding Monitor</p>
            </div>
            <div class="status-badge">
                <div class="pulse"></div>
                SYSTEM ONLINE
            </div>
        </header>

        <div class="stats-grid">
            <div class="stat-card fade-in" style="animation-delay: 0.1s">
                <div class="stat-label">MANAGED TOOLS</div>
                <div class="stat-value" style="color: var(--accent)">${data.stats.activeTools}</div>
            </div>
            <div class="stat-card fade-in" style="animation-delay: 0.2s">
                <div class="stat-label">TOTAL INVOCATIONS</div>
                <div class="stat-value">${data.stats.totalCalls}</div>
            </div>
            <div class="stat-card fade-in" style="animation-delay: 0.3s">
                <div class="stat-label">SUCCESS ACCURACY</div>
                <div class="stat-value" style="color: ${data.stats.successRate > 90 ? 'var(--success)' : 'var(--error)'}">
                    ${data.stats.successRate}%
                </div>
            </div>
        </div>

        <div class="section-header fade-in" style="animation-delay: 0.4s">
            <h2>Inventory & Consumption</h2>
            <div class="line"></div>
        </div>
        
        <div class="data-card fade-in" style="animation-delay: 0.4s">
            <table>
                <thead>
                    <tr>
                        <th>Resource Name</th>
                        <th>Type</th>
                        <th>Requests</th>
                        <th>Usage Intensity</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.inventory.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding: 40px; color: var(--text-secondary)">No tools registered or discovered yet.</td></tr>' : ''}
                    ${data.inventory.map(t => {
                        const usage = data.toolUsage[t.name] || 0;
                        const share = data.stats.totalCalls > 0 ? (usage / data.stats.totalCalls) * 100 : 0;
                        const isNative = t.name.startsWith('native:');
                        const displayName = isNative ? t.name.replace('native:', '') : t.name;
                        
                        return `
                        <tr>
                            <td>
                                <div class="tool-name">${displayName}</div>
                                <div class="tool-cmd">${t.command && t.command[0] !== 'N/A' ? t.command[0] : (isNative ? 'Internal Provider' : 'Lazy-Loaded')}</div>
                            </td>
                            <td><span class="tag ${isNative ? 'tag-native' : 'tag-success'}">${isNative ? 'PLATFORM' : 'MCP'}</span></td>
                            <td style="font-weight: 600; font-variant-numeric: tabular-nums;">${usage}</td>
                            <td>
                                <div class="progress-box">
                                    <div class="progress-bar"><div class="progress-fill" style="width: ${share}%"></div></div>
                                    <span class="progress-val">${Math.round(share)}%</span>
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <div class="section-header fade-in" style="animation-delay: 0.5s">
            <h2>Audit Trail & Accountability</h2>
            <div class="line"></div>
        </div>

        <div class="data-card fade-in" style="animation-delay: 0.5s">
            <table>
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Resource</th>
                        <th>Agent Action</th>
                        <th>Latency</th>
                        <th>Outcome</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.logs.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--text-secondary)">Waiting for activities...</td></tr>' : ''}
                    ${data.logs.map(l => {
                        const isNative = l.tool.startsWith('native:');
                        const toolName = isNative ? l.tool.replace('native:', '') : l.tool;
                        return `
                        <tr>
                            <td class="log-time">${l.iso_time.split('T')[1]}</td>
                            <td><span class="tag ${isNative ? 'tag-native' : 'tag-success'}">${isNative ? 'PLATFORM' : 'MCP'}</span></td>
                            <td>
                                <div style="font-weight: 600; color: #fff;">${toolName}</div>
                                <div class="log-detail" title="${l.details || ''}">${l.details || 'No trace available'}</div>
                            </td>
                            <td style="font-variant-numeric: tabular-nums">${l.duration ? l.duration.toFixed(3) + 's' : '< 1ms'}</td>
                            <td>
                                <span class="tag ${l.success ? 'tag-success' : 'tag-error'}">${l.success ? 'RESOLVED' : 'FAILED'}</span>
                                ${l.error ? '<div style="color:var(--error); font-size:10px; margin-top:4px;">' + l.error + '</div>' : ''}
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>

        <footer>
            <div>&copy; 2026 Antigravity MCP Manager</div>
            <div class="debug-info">
                Logs: ${logPath} | Manifest: ${manifestPath}
            </div>
        </footer>
    </div>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

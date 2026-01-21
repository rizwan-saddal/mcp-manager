import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class DashboardGenerator {
    static async getHtml(extensionUri: vscode.Uri, logPath: string, manifestPath: string): Promise<string> {
        // 1. Read Data
        let tools: any[] = [];
        let logs: any[] = [];
        
        try {
            if (fs.existsSync(manifestPath)) {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                tools = manifest.tools || [];
            }
        } catch (e) {
            console.error("Error reading manifest:", e);
        }

        try {
            if (fs.existsSync(logPath)) {
                // Read last 1000 lines? Or all? Let's read all for now, it's local.
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
        
        // Group by Tool
        const toolUsage: {[key: string]: number} = {};
        logs.forEach(l => {
            toolUsage[l.tool] = (toolUsage[l.tool] || 0) + 1;
        });

        // Group Tools by "Server" (in our case, they are all routed, but we can group by prefix if available, or just list unique tools)
        // For now, treat each tool as a potential "Server endpoint"
        
        const data = {
            tools,
            logs: logs.reverse().slice(0, 100), // Last 100
            stats: {
                totalCalls,
                successRate,
                activeTools: tools.length
            },
            toolUsage
        };

        // 3. Generate HTML
        const nonce = getNonce();
        
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
            --success: #2ea043;
            --error: #da3633;
            --border: #30363d;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            margin: 0;
            padding: 20px;
        }

        /* Layout */
        .container {
            max-width: 1000px;
            margin: 0 auto;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 20px;
        }

        h1 { margin: 0; font-size: 24px; font-weight: 600; }
        h2 { font-size: 18px; margin-bottom: 15px; border-left: 3px solid var(--accent); padding-left: 10px; }

        .badge {
            background: var(--accent);
            color: #fff;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }

        /* Stats Grid */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .stat-value { font-size: 32px; font-weight: 700; margin: 10px 0; }
        .stat-label { color: var(--text-secondary); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }

        /* Tables & Lists */
        .section { margin-bottom: 40px; }
        
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        th, td {
            text-align: left;
            padding: 12px 15px;
            border-bottom: 1px solid var(--border);
        }

        th { background: #21262d; color: var(--text-secondary); font-weight: 600; }
        tr:last-child td { border-bottom: none; }
        tr:hover { background: #21262d; }

        .status-dot {
            height: 10px;
            width: 10px;
            background-color: var(--text-secondary);
            border-radius: 50%;
            display: inline-block;
            margin-right: 5px;
        }
        .status-dot.active { background-color: var(--success); box-shadow: 0 0 5px var(--success); }
        .status-dot.error { background-color: var(--error); }

        .progress-bar {
            background: #21262d;
            height: 6px;
            border-radius: 3px;
            overflow: hidden;
            width: 100%;
        }
        .progress-fill {
            height: 100%;
            background: var(--accent);
        }

        /* Animations */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate { animation: fadeIn 0.5s ease-out forwards; }

    </style>
</head>
<body>
    <div class="container">
        <header class="animate">
            <div>
                <h1>MCP System Monitor</h1>
                <p style="color: var(--text-secondary); margin-top: 5px;">Lazy Loading Router / UV Orchestration</p>
            </div>
            <div class="badge">Connected</div>
        </header>

        <div class="stats-grid animate" style="animation-delay: 0.1s;">
            <div class="stat-card">
                <div class="stat-label">Active Servers (Tools)</div>
                <div class="stat-value" style="color: var(--accent);">${data.stats.activeTools}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Requests</div>
                <div class="stat-value">${data.stats.totalCalls}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Success Rate</div>
                <div class="stat-value" style="color: ${data.stats.successRate > 90 ? 'var(--success)' : 'var(--error)'};">
                    ${data.stats.successRate}%
                </div>
            </div>
        </div>

        <div class="section animate" style="animation-delay: 0.2s;">
            <h2>Server Inventory & Consumption</h2>
            <div class="card">
                <table>
                    <thead>
                        <tr>
                            <th>Tool / Server</th>
                            <th>Status</th>
                            <th>Calls</th>
                            <th>Usage Share</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.tools.map(t => {
                            const usage = data.toolUsage[t.name] || 0;
                            const share = data.stats.totalCalls > 0 ? (usage / data.stats.totalCalls) * 100 : 0;
                            return `
                            <tr>
                                <td><strong>${t.name}</strong><br><span style="color:var(--text-secondary); font-size:12px;">${t.command ? t.command[0] : 'N/A'}</span></td>
                                <td><span class="status-dot active"></span> Ready</td>
                                <td>${usage}</td>
                                <td style="width: 200px;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <div class="progress-bar"><div class="progress-fill" style="width: ${share}%"></div></div>
                                        <span style="font-size:12px; color:var(--text-secondary);">${Math.round(share)}%</span>
                                    </div>
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="section animate" style="animation-delay: 0.3s;">
            <h2>Accountability & Recent Logs</h2>
            <div class="card">
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Agent / Source</th>
                            <th>Tool Invoked</th>
                            <th>Duration</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.logs.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 20px;">No logs available</td></tr>' : ''}
                        ${data.logs.map(l => `
                        <tr>
                            <td style="color:var(--text-secondary);">${l.iso_time}</td>
                            <td>User <span style="opacity:0.5; font-size:10px;">(Default)</span></td>
                            <td>${l.tool}</td>
                            <td>${l.duration.toFixed(3)}s</td>
                            <td>
                                <span style="color: ${l.success ? 'var(--success)' : 'var(--error)'}">${l.success ? 'Success' : 'Failed'}</span>
                                ${l.error ? '<br><span style="color:var(--error); font-size:10px;">' + l.error.substring(0,50) + '...</span>' : ''}
                            </td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
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

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { 
  Search, 
  Box, 
  Terminal, 
  Cpu, 
  Cloud, 
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type LogType = 'success' | 'info' | 'error';
type ServerStatus = 'idle' | 'running' | 'error';

interface Log {
  id: string;
  time: string;
  message: string;
  type: LogType;
}

interface McpServer {
  id: string;
  title: string;
  description: string;
  image?: string;
  iconUrl?: string;
  category: string;
  enabled: boolean;
  status?: ServerStatus;
  
  configSchema?: ConfigField[];
  
  // Community specific
  repo?: string; 
  subpath?: string;
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'path' | 'email';
  required: boolean;
  description: string;
  placeholder?: string;
  pattern?: string; 
  errorMessage?: string; 
}

type DataSource = 'docker' | 'community';

declare global {
  interface Window {
    vscode: any;
    extensionIcon?: string;
  }
}

const CATEGORIES = ['All', 'Search', 'DevOps', 'Database', 'Productivity', 'AI', 'Cloud', 'Utilities'];

export default function App() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [communityServers, setCommunityServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('docker');

  const [logs, setLogs] = useState<Log[]>([
    { id: 'init', time: new Date().toLocaleTimeString(), message: 'Dashboard initialized', type: 'info' }
  ]);
  const [dockerChecked, setDockerChecked] = useState(false);
  const [configuringServer, setConfiguringServer] = useState<McpServer | null>(null);

  const addLog = (message: string, type: LogType = 'info') => {
    setLogs(prev => [{
      id: Math.random().toString(36).substring(7),
      time: new Date().toLocaleTimeString(),
      message,
      type
    }, ...prev]);
  };

  // Keep refs for values needed inside the event listener
  const dataSourceRef = useRef(dataSource);
  const dockerCheckedRef = useRef(dockerChecked);

  useEffect(() => {
    dataSourceRef.current = dataSource;
  }, [dataSource]);

  useEffect(() => {
    dockerCheckedRef.current = dockerChecked;
  }, [dockerChecked]);

  useEffect(() => {
    // Initial load
    if (globalThis.window?.vscode) {
        globalThis.window.vscode.postMessage({ command: 'check_docker' });
        globalThis.window.vscode.postMessage({ command: 'list_servers' });
        addLog('Requesting server catalog...', 'info');
    }

    const handler = (event: MessageEvent) => {
        const message = event.data;
        const currentDataSource = dataSourceRef.current;
        const isDockerChecked = dockerCheckedRef.current;

        switch (message.command) {
            case 'docker_status':
                setDockerChecked(true);
                if (!message.available) {
                    setDataSource('community');
                    addLog('Docker command not found or inaccessible. Switching to Community Hub.', 'error');
                    globalThis.window.vscode.postMessage({ command: 'fetch_community_servers' });
                } else {
                    addLog('Docker Desktop integration verified.', 'success');
                }
                break;
            case 'servers_list':
                setServers(message.data);
                if (isDockerChecked || currentDataSource === 'docker') {
                    setLoading(false);
                }
                setError(null);
                addLog(`Catalog updated: ${message.data.length} servers found`, 'success');
                break;
            case 'community_servers_list': {
                // Map community data to McpServer shape
                const mapped = message.data.map((s: any) => ({
                    ...s,
                    enabled: false,
                    image: s.subpath || 'git-repo'
                }));
                setCommunityServers(mapped);
                setLoading(false);
                break;
            }
            case 'server_added':
                addLog(`Server enabled: ${message.serverId}`, 'success');
                // Refresh server list to show enabled state
                globalThis.window.vscode.postMessage({ command: 'list_servers' });
                break;
            case 'server_removed':
                addLog(`Server disabled: ${message.serverId}`, 'info');
                // Refresh server list
                globalThis.window.vscode.postMessage({ command: 'list_servers' });
                break;
            case 'server_cloned':
                addLog(`Server cloned successfully: ${message.serverId}`, 'success');
                break;
            case 'error':
            case 'operation_error':
                setLoading(false);
                setError(message.message);
                addLog(`Error: ${message.message}`, 'error');
                break;
        }
    };

    globalThis.window?.addEventListener('message', handler);
    return () => globalThis.window?.removeEventListener('message', handler);
  }, []);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 24;

  const activeList = dataSource === 'docker' ? servers : communityServers;
  const filteredServers = activeList.filter(s => 
    (activeCategory === 'All' || s.category === activeCategory) &&
    (s.title.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredServers.length / ITEMS_PER_PAGE);
  const displayedServers = filteredServers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeCategory]);

  const toggleServer = (server: McpServer) => {
    if (globalThis.window?.vscode) {
        if (dataSource === 'community') {
            if (server.configSchema && server.configSchema.length > 0) {
                setConfiguringServer(server);
                return;
            }
            addLog(`Initiating installation for ${server.id}...`, 'info');
            globalThis.window.vscode.postMessage({ command: 'install_community_server', server });
            return;
        }

        if (server.enabled) {
            addLog(`Stopping server: ${server.id}...`, 'info');
            globalThis.window.vscode.postMessage({ command: 'remove_server', serverId: server.id });
        } else {
            if (server.configSchema && server.configSchema.length > 0) {
                setConfiguringServer(server);
                return;
            }
            addLog(`Starting server: ${server.id}...`, 'info');
            globalThis.window.vscode.postMessage({ command: 'add_server', serverId: server.id });
        }
    }
  };

  const handleConfigSubmit = (env: Record<string, string>) => {
      if (!configuringServer) return;
      
      if (configuringServer.repo) {
          // Community Server
          addLog(`Starting installation with config: ${configuringServer.id}...`, 'info');
          globalThis.window.vscode.postMessage({ command: 'install_community_server', server: configuringServer, env });
      } else {
          // Docker/Local Server
          addLog(`Starting server with config: ${configuringServer.id}...`, 'info');
          globalThis.window.vscode.postMessage({ command: 'add_server', serverId: configuringServer.id, env });
      }
      setConfiguringServer(null);
  };

  return (
    <div className="min-h-screen p-4 lg:p-8 max-w-[1800px] mx-auto text-sm selection:bg-neon-cyan/30">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 relative z-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-cyan opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-neon-cyan"></span>
            </div>
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-neon-cyan/80 font-bold">System Online</span>
          </div>
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-white mb-2">
              <span className="text-transparent bg-clip-text bg-linear-to-r from-white to-white/50">Mcp</span>
              <span className="font-light text-white/30 mx-2">/</span>
              <span className="text-neon-cyan">Manager</span>
            </h1>
            <p className="text-text-secondary text-base max-w-xl font-light leading-relaxed">
              Advanced orchestration for Model Context Protocol servers.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4">
          <div className="flex p-1 bg-white/5 rounded-lg border border-white/5">
            <button
                onClick={() => { setDataSource('docker'); setLoading(true); globalThis.window.vscode.postMessage({ command: 'list_servers' }); }}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${dataSource === 'docker' ? 'bg-neon-cyan/20 text-neon-cyan shadow-[0_0_10px_-3px_rgba(34,211,238,0.3)]' : 'text-text-muted hover:text-white'}`}
            >
                Docker Registry
            </button>
            <button
                onClick={() => { setDataSource('community'); setLoading(true); globalThis.window.vscode.postMessage({ command: 'fetch_community_servers' }); }}
                className={`px-4 py-2 rounded-md text-xs font-medium transition-all ${dataSource === 'community' ? 'bg-neon-cyan/20 text-neon-cyan shadow-[0_0_10px_-3px_rgba(34,211,238,0.3)]' : 'text-text-muted hover:text-white'}`}
            >
                Community Hub
            </button>
          </div>

          <div className="glass px-8 py-4 flex items-center gap-8 bg-black/20">
            <div className="text-right">
              <div className="mono text-3xl font-light text-white">
                  {dataSource === 'docker' ? filteredServers.filter(s => s.enabled).length : filteredServers.length}
              </div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-text-muted font-medium mt-1">
                  {dataSource === 'docker' ? 'Active' : 'Available'}
              </div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <div className="mono text-3xl font-light text-white/40">
                  {filteredServers.length}
              </div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-text-muted font-medium mt-1">Total</div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Sidebar / Controls */}
        <aside className="xl:col-span-1 space-y-4">
          <div className="glass p-5 space-y-6 bg-black/20">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-neon-cyan transition-colors" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full bg-white/5 border border-white/5 rounded-lg py-3 pl-11 pr-4 focus:outline-none focus:border-neon-cyan/50 focus:bg-white/10 transition-all text-sm placeholder:text-text-muted/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <h3 className="mono text-[9px] uppercase tracking-[0.2em] text-text-muted mb-4 px-2 font-semibold">Filter Systems</h3>
              <div className="flex flex-wrap xl:flex-col gap-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all duration-300 group ${
                      activeCategory === cat 
                      ? 'bg-white/10 text-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.1)]' 
                      : 'text-text-secondary hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="font-medium tracking-wide">{cat}</span>
                    <div className={`w-1.5 h-1.5 rounded-full transition-all ${
                        activeCategory === cat ? 'bg-neon-cyan shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-transparent group-hover:bg-white/20'
                    }`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="glass p-5 bg-black/20 overflow-hidden flex flex-col max-h-[400px]">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="mono text-[9px] uppercase tracking-[0.2em] text-text-muted font-bold">Terminal</h3>
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                </div>
            </div>
            <div className="space-y-3 overflow-y-auto pr-2 font-mono text-xs custom-scrollbar">
              {logs.map((log) => (
                <LogEntry key={log.id} time={log.time} message={log.message} type={log.type} />
              ))}
            </div>
          </div>
        </aside>

        {/* Catalog Grid */}
        <main className="xl:col-span-3">
          {loading && (
            <div className="flex items-center justify-center h-64 glass">
              <div className="text-neon-cyan mono animate-pulse">Scanning Registry...</div>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-64 glass border-rose-500/20">
              <XCircle className="w-12 h-12 text-rose-500 mb-4" />
              <div className="text-rose-400 mono mb-2">Access Denied / System Error</div>
              <p className="text-text-secondary text-sm px-8 text-center">{error}</p>
              <button 
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  if (globalThis.window?.vscode) {
                    globalThis.window.vscode.postMessage({ command: 'list_servers' });
                  }
                }}
                className="mt-6 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold transition-all"
              >
                Retry Scan
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
                {displayedServers.map((s, idx) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: idx * 0.02, duration: 0.2 }}
                  key={s.id}
                  className="glass-card flex flex-col group h-full hover:bg-white/5 transition-colors border border-white/5 hover:border-white/10"
                >
                  <div className="p-4 flex flex-col h-full relative z-10">
                    <div className="flex justify-between items-start gap-3 mb-2">
                       <div className="flex items-center gap-3 min-w-0">
                            <div className="shrink-0 p-1.5 rounded-lg bg-linear-to-br from-white/10 to-white/5 border border-white/5 text-white/80 group-hover:text-neon-cyan transition-colors">
                                <ServerIcon server={s} categoryIcon={getCategoryIcon(s.category)} />
                            </div>
                            <h3 className="text-sm font-semibold text-white group-hover:text-neon-cyan transition-colors truncate">{s.title}</h3>
                       </div>

                       {s.enabled && (
                            <div className="shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" title="Active" />
                        )}
                    </div>

                    <p className="text-text-secondary/70 text-[11px] leading-relaxed mb-3 font-light line-clamp-2 min-h-[2.5em] grow">{s.description}</p>

                     <ActionButton 
                        server={s} 
                        dataSource={dataSource} 
                        onToggle={() => toggleServer(s)} 
                      />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Pagination Controls */}
            {totalPages > 1 && (
            <div className="col-span-full flex justify-center items-center gap-4 mt-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
              >
                Previous
              </button>
              <div className="mono text-xs text-text-muted">
                Wait {currentPage} / {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
              >
                Next
              </button>
            </div>
            )}
            {filteredServers.length === 0 && (
              <div className="col-span-full py-20 text-center glass border-dashed">
                <div className="text-text-muted mono mb-2">No systems located</div>
                <p className="text-text-muted text-sm px-8">No MCP servers match your current search or category filters.</p>
              </div>
            )}
          </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {configuringServer && (
            <ConfigModal 
                server={configuringServer} 
                onClose={() => setConfiguringServer(null)} 
                onSubmit={handleConfigSubmit} 
            />
        )}
      </AnimatePresence>
    </div>
  );
}

interface ActionButtonProps {
  readonly server: McpServer;
  readonly dataSource: DataSource;
  readonly onToggle: () => void;
}

function ActionButton({ server, dataSource, onToggle }: ActionButtonProps) {
  let className = "w-full py-3 rounded-lg text-xs font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ";
  let content: ReactNode = null;

  if (dataSource === 'community') {
    className += "bg-white/10 text-white hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_25px_-5px_rgba(34,211,238,0.6)] border border-white/10 hover:border-neon-cyan";
    content = (
      <>
        <span className="text-lg leading-none">+</span>
        {' '}
        INITIALIZE SYSTEM
      </>
    );
  } else if (server.enabled) {
    className += "bg-white/5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 border border-white/5 hover:border-rose-500/20";
    content = (
      <>
        <div className="w-1.5 h-1.5 rounded-full bg-current" />
        {' '}
        STOP SYSTEM
      </>
    );
  } else {
    className += "bg-white/10 text-white hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_25px_-5px_rgba(34,211,238,0.6)] border border-white/10 hover:border-neon-cyan";
    content = (
      <>
        <span className="text-lg leading-none">+</span>
        {' '}
        INITIALIZE
      </>
    );
  }

  return (
    <button onClick={onToggle} className={className}>
      {content}
    </button>
  );
}

interface ServerIconProps {
  readonly server: McpServer;
  readonly categoryIcon: ReactNode;
}

function ServerIcon({ server, categoryIcon }: ServerIconProps) {
  const [imageError, setImageError] = useState(false);

  if (server.iconUrl && !imageError) {
    return (
      <img 
        src={server.iconUrl} 
        alt={server.title} 
        className="w-5 h-5 object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
        onError={() => setImageError(true)}
      />
    );
  }

  return <>{categoryIcon}</>;
}

interface LogEntryProps {
  readonly time: string;
  readonly message: string;
  readonly type: LogType;
}

function LogEntry({ time, message, type }: LogEntryProps) {
  const colors = {
    success: 'text-emerald-400',
    info: 'text-blue-300',
    error: 'text-rose-400'
  };

  return (
    <div className="flex gap-3 text-[10px] leading-relaxed font-mono opacity-80 hover:opacity-100 transition-opacity">
      <span className="text-white/30 shrink-0">[{time}]</span>
      <span className={colors[type]}>{message}</span>
    </div>
  );
}

function getCategoryIcon(category: string) {
  switch(category) {
    case 'Search': return <Search className="w-5 h-5" />;
    case 'DevOps': return <Terminal className="w-5 h-5" />;
    case 'Database': return <Box className="w-5 h-5" />;
    case 'AI': return <Cpu className="w-5 h-5" />;
    default: return <Cloud className="w-5 h-5" />;
  }
}

interface ConfigModalProps {
    server: McpServer;
    onClose: () => void;
    onSubmit: (env: Record<string, string>) => void;
}

function ConfigModal({ server, onClose, onSubmit }: ConfigModalProps) {
    const [values, setValues] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (key: string, value: string, field: ConfigField) => {
        setValues(prev => ({ ...prev, [key]: value }));
        
        if (field.pattern) {
            const regex = new RegExp(field.pattern);
            if (!regex.test(value)) {
                setErrors(prev => ({ ...prev, [key]: field.errorMessage || 'Invalid format' }));
            } else {
                 setErrors(prev => {
                     const next = { ...prev };
                     delete next[key];
                     return next;
                 });
            }
        }
    };

    const isValid = server.configSchema?.every(field => {
        if (field.required && !values[field.key]) return false;
        if (errors[field.key]) return false;
        return true;
    }) ?? true;

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0D0D0D] border border-white/10 rounded-2xl w-full max-w-lg shadow-[0_0_50px_-10px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Configure {server.title}</h2>
                        <p className="text-text-secondary text-xs mt-1">Configure environment variables for this server.</p>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-white transition-colors" aria-label="Close configuration" title="Close">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {server.configSchema?.map(field => (
                        <div key={field.key} className="space-y-2 group">
                            <label className="text-xs font-mono uppercase tracking-wider text-neon-cyan/80 group-focus-within:text-neon-cyan transition-colors">
                                {field.label} {field.required && <span className="text-rose-400">*</span>}
                            </label>
                            <div className="relative">
                                <input
                                    type={field.type === 'path' ? 'text' : field.type}
                                    className={`w-full bg-black/40 border rounded-lg px-4 py-3 text-sm focus:outline-none transition-all placeholder:text-white/20
                                        ${errors[field.key] 
                                            ? 'border-rose-500/50 focus:border-rose-500' 
                                            : 'border-white/10 focus:border-neon-cyan/50 focus:shadow-[0_0_15px_-5px_rgba(34,211,238,0.2)]'
                                        }
                                        text-white
                                    `}
                                    placeholder={field.placeholder}
                                    value={values[field.key] || ''}
                                    onChange={(e) => handleChange(field.key, e.target.value, field)}
                                />
                            </div>
                            {errors[field.key] && (
                                <p className="text-[10px] text-rose-400 font-mono flex items-center gap-1">
                                    <span className="inline-block w-1 h-1 bg-rose-400 rounded-full"/>
                                    {errors[field.key]}
                                </p>
                            )}
                            {field.description && !errors[field.key] && (
                                <p className="text-[11px] text-text-muted/70 leading-relaxed font-light">
                                    {field.description}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t border-white/5 bg-white/5 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-xs font-medium text-text-muted hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!isValid}
                        onClick={() => onSubmit(values)}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all duration-300
                            ${isValid 
                                ? 'bg-neon-cyan text-black hover:shadow-[0_0_20px_-5px_rgba(34,211,238,0.5)] hover:scale-105' 
                                : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
                            }
                        `}
                    >
                        INITIALIZE SYSTEM
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

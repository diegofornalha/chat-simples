/**
 * Sistema de Debug Completo para Claude Chat
 * Ativa com: localStorage.setItem('DEBUG', 'true')
 */

class DebugSystem {
    constructor() {
        this.enabled = localStorage.getItem('DEBUG') === 'true';
        this.logs = [];
        this.metrics = {
            messagesTotal: 0,
            chunksReceived: 0,
            errorsCount: 0,
            totalCost: 0,
            avgResponseTime: 0,
            responseTimes: []
        };

        if (this.enabled) {
            this.createDebugPanel();
            console.log('🔍 Debug System ATIVADO');
        }
    }

    createDebugPanel() {
        const panel = document.createElement('div');
        panel.id = 'debug-panel';
        panel.innerHTML = `
            <div class="debug-header">
                <h3>🔍 Debug Panel</h3>
                <button id="debug-close">✕</button>
            </div>
            <div class="debug-tabs">
                <button class="debug-tab active" data-tab="logs">📝 Logs</button>
                <button class="debug-tab" data-tab="metrics">📊 Métricas</button>
                <button class="debug-tab" data-tab="network">🌐 Network</button>
                <button class="debug-tab" data-tab="performance">⚡ Performance</button>
            </div>
            <div class="debug-content">
                <div id="debug-logs" class="debug-section active"></div>
                <div id="debug-metrics" class="debug-section"></div>
                <div id="debug-network" class="debug-section"></div>
                <div id="debug-performance" class="debug-section"></div>
            </div>
            <div class="debug-actions">
                <button id="debug-clear">🗑️ Limpar</button>
                <button id="debug-export">📥 Export</button>
                <button id="debug-copy">📋 Copy</button>
            </div>
        `;

        document.body.appendChild(panel);

        // Event listeners
        document.getElementById('debug-close').onclick = () => this.toggle();
        document.getElementById('debug-clear').onclick = () => this.clear();
        document.getElementById('debug-export').onclick = () => this.export();
        document.getElementById('debug-copy').onclick = () => this.copyToClipboard();

        // Tabs
        document.querySelectorAll('.debug-tab').forEach(tab => {
            tab.onclick = () => this.switchTab(tab.dataset.tab);
        });

        // Add CSS
        this.injectStyles();

        // Shortcut: Ctrl+Shift+D para toggle
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                this.toggle();
            }
        });
    }

    log(level, category, message, data = null) {
        if (!this.enabled) return;

        const entry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            data
        };

        this.logs.push(entry);

        // Limitar a 1000 logs
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000);
        }

        // Mostrar no console
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'debug': '🔍'
        }[level] || '📝';

        console.log(`${emoji} [${category}] ${message}`, data || '');

        // Atualizar painel
        this.updateLogsPanel();
    }

    updateLogsPanel() {
        const panel = document.getElementById('debug-logs');
        if (!panel) return;

        panel.innerHTML = this.logs.slice(-50).reverse().map(log => `
            <div class="debug-log-entry debug-${log.level}">
                <span class="debug-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span class="debug-category">[${log.category}]</span>
                <span class="debug-message">${log.message}</span>
                ${log.data ? `<pre class="debug-data">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
            </div>
        `).join('');
    }

    updateMetrics(update) {
        Object.assign(this.metrics, update);
        this.updateMetricsPanel();
    }

    updateMetricsPanel() {
        const panel = document.getElementById('debug-metrics');
        if (!panel) return;

        const avg = this.metrics.responseTimes.length > 0
            ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
            : 0;

        panel.innerHTML = `
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${this.metrics.messagesTotal}</div>
                    <div class="metric-label">Mensagens Enviadas</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.metrics.chunksReceived}</div>
                    <div class="metric-label">Chunks Recebidos</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.metrics.errorsCount}</div>
                    <div class="metric-label">Erros</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">$${this.metrics.totalCost.toFixed(4)}</div>
                    <div class="metric-label">Custo Total</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${avg.toFixed(0)}ms</div>
                    <div class="metric-label">Tempo Médio</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${this.metrics.responseTimes.length}</div>
                    <div class="metric-label">Respostas</div>
                </div>
            </div>
        `;
    }

    switchTab(tabName) {
        // Update tabs
        document.querySelectorAll('.debug-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update sections
        document.querySelectorAll('.debug-section').forEach(section => {
            section.classList.remove('active');
        });

        document.getElementById(`debug-${tabName}`).classList.add('active');

        // Update content if needed
        if (tabName === 'metrics') {
            this.updateMetricsPanel();
        }
    }

    toggle() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        }
    }

    clear() {
        this.logs = [];
        this.updateLogsPanel();
    }

    export() {
        const data = {
            logs: this.logs,
            metrics: this.metrics,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug_${Date.now()}.json`;
        a.click();
    }

    copyToClipboard() {
        const text = this.logs.map(log =>
            `[${log.timestamp}] ${log.level.toUpperCase()} [${log.category}] ${log.message}`
        ).join('\n');

        navigator.clipboard.writeText(text);
        alert('✅ Logs copiados para clipboard!');
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #debug-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 600px;
                max-height: 400px;
                background: #1e293b;
                border: 2px solid #6366f1;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                z-index: 9999;
                font-family: 'Courier New', monospace;
                font-size: 12px;
            }

            .debug-header {
                padding: 10px 15px;
                background: #6366f1;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 10px 10px 0 0;
            }

            .debug-header h3 {
                margin: 0;
                font-size: 14px;
            }

            #debug-close {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0 5px;
            }

            .debug-tabs {
                display: flex;
                background: #0f172a;
                border-bottom: 1px solid #334155;
            }

            .debug-tab {
                flex: 1;
                padding: 8px 12px;
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s;
            }

            .debug-tab.active {
                background: #1e293b;
                color: #6366f1;
                border-bottom: 2px solid #6366f1;
            }

            .debug-tab:hover {
                background: #1e293b;
            }

            .debug-content {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
                background: #0f172a;
            }

            .debug-section {
                display: none;
            }

            .debug-section.active {
                display: block;
            }

            .debug-log-entry {
                padding: 6px 8px;
                margin-bottom: 4px;
                border-radius: 4px;
                background: #1e293b;
                border-left: 3px solid #334155;
            }

            .debug-log-entry.debug-error {
                border-left-color: #ef4444;
                background: rgba(239, 68, 68, 0.1);
            }

            .debug-log-entry.debug-warning {
                border-left-color: #f59e0b;
                background: rgba(245, 158, 11, 0.1);
            }

            .debug-log-entry.debug-success {
                border-left-color: #10b981;
                background: rgba(16, 185, 129, 0.1);
            }

            .debug-time {
                color: #64748b;
                margin-right: 8px;
            }

            .debug-category {
                color: #8b5cf6;
                font-weight: bold;
                margin-right: 8px;
            }

            .debug-message {
                color: #f1f5f9;
            }

            .debug-data {
                margin-top: 4px;
                padding: 4px;
                background: #0f172a;
                border-radius: 4px;
                color: #10b981;
                font-size: 10px;
                max-height: 100px;
                overflow: auto;
            }

            .debug-actions {
                padding: 10px 15px;
                background: #1e293b;
                border-top: 1px solid #334155;
                display: flex;
                gap: 8px;
            }

            .debug-actions button {
                flex: 1;
                padding: 6px 12px;
                border-radius: 6px;
                border: 1px solid #334155;
                background: #0f172a;
                color: #f1f5f9;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s;
            }

            .debug-actions button:hover {
                background: #334155;
                border-color: #6366f1;
            }

            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }

            .metric-card {
                background: #1e293b;
                padding: 15px;
                border-radius: 8px;
                border: 1px solid #334155;
            }

            .metric-value {
                font-size: 24px;
                font-weight: bold;
                color: #6366f1;
                margin-bottom: 4px;
            }

            .metric-label {
                font-size: 11px;
                color: #94a3b8;
                text-transform: uppercase;
            }
        `;

        document.head.appendChild(style);
    }
}

// Inicializar sistema de debug
window.debugSystem = new DebugSystem();

// Helpers globais
window.enableDebug = () => {
    localStorage.setItem('DEBUG', 'true');
    location.reload();
};

window.disableDebug = () => {
    localStorage.setItem('DEBUG', 'false');
    location.reload();
};

window.showDebug = () => {
    const panel = document.getElementById('debug-panel');
    if (panel) panel.style.display = 'flex';
};

window.hideDebug = () => {
    const panel = document.getElementById('debug-panel');
    if (panel) panel.style.display = 'none';
};

// Console.log interceptor para capturar tudo
if (window.debugSystem.enabled) {
    const originalLog = console.log;
    console.log = function(...args) {
        originalLog.apply(console, args);

        // Extrair info do log
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');

        window.debugSystem.log('debug', 'console', message);
    };

    const originalError = console.error;
    console.error = function(...args) {
        originalError.apply(console, args);

        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');

        window.debugSystem.log('error', 'console', message);
        window.debugSystem.metrics.errorsCount++;
    };
}

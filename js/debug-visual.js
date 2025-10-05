/**
 * Debug Visual - Painel de debug simples e visual
 */

class DebugVisual {
    constructor() {
        this.logs = [];
        this.isOpen = false;
        this.init();
    }

    init() {
        const toggleBtn = document.getElementById('debug-toggle-btn');

        if (toggleBtn) {
            toggleBtn.innerHTML = '<span class="debug-toggle-icon">☰</span>';
            toggleBtn.title = 'Debug Visual (Ctrl+D)';
            toggleBtn.onclick = () => this.toggle();
        }

        // Atalho Ctrl+D
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggle();
            }
        });

        console.log('🔍 Debug Visual ativado (clique no 🔍 ou Ctrl+D)');
    }

    toggle() {
        this.isOpen = !this.isOpen;
        const panel = document.getElementById('debug-visual-panel');
        const btn = document.getElementById('debug-toggle-btn');

        if (panel) {
            panel.style.display = this.isOpen ? 'flex' : 'none';
        }

        if (btn) {
            btn.innerHTML = this.isOpen
                ? '<span class="debug-toggle-icon">×</span>'
                : '<span class="debug-toggle-icon">☰</span>';
            btn.title = this.isOpen ? 'Fechar Debug (Ctrl+D)' : 'Debug Visual (Ctrl+D)';
        }

        requestAnimationFrame(() => this.updateLayoutOffset());
    }

    close() {
        this.isOpen = false;
        const panel = document.getElementById('debug-visual-panel');
        if (panel) {
            panel.style.display = 'none';
        }
        this.updateLayoutOffset();
    }

    updateLayoutOffset() {
        const panel = document.getElementById('debug-visual-panel');
        let offset = 0;

        if (this.isOpen && panel) {
            const panelHeight = panel.offsetHeight;
            const extraGap = 16; // espaçamento visual entre painel e conteúdo
            offset = panelHeight + extraGap;
        }

        document.documentElement.style.setProperty('--sticky-offset', `${offset}px`);
    }

    log(level, message, data = null) {
        const timestamp = new Date().toLocaleTimeString('pt-BR');

        const entry = {
            timestamp,
            level,
            message,
            data
        };

        this.logs.push(entry);

        // Manter apenas últimos 50
        if (this.logs.length > 50) {
            this.logs.shift();
        }

        this.render();
    }

    render() {
        if (!this.isOpen) return;

        const content = document.querySelector('#debug-visual-content .debug-log');
        if (!content) return;

        content.innerHTML = this.logs.slice().reverse().map(entry => {
            const emoji = {
                'info': 'ℹ️',
                'success': '✅',
                'warning': '⚠️',
                'error': '❌',
                'websocket': '🔌',
                'message': '💬'
            }[entry.level] || '📝';

            const levelClass = `debug-entry-${entry.level}`;

            return `
                <div class="debug-entry ${levelClass}">
                    <span class="debug-time">${entry.timestamp}</span>
                    <span class="debug-icon">${emoji}</span>
                    <span class="debug-msg">${entry.message}</span>
                    ${entry.data ? `<pre class="debug-data-small">${JSON.stringify(entry.data, null, 2).substring(0, 200)}</pre>` : ''}
                </div>
            `;
        }).join('');

        // Auto-scroll para última entrada
        content.scrollTop = 0;
    }

    clear() {
        this.logs = [];
        this.render();
    }
}

// CSS para debug visual
const debugVisualStyles = `
    .debug-toggle-btn-top {
        position: fixed;
        top: 16px;
        left: 16px;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(15, 23, 42, 0.55);
        color: white;
        border: none;
        border-radius: 9999px;
        font-size: 0.85rem;
        font-weight: 500;
        cursor: pointer;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.2);
        backdrop-filter: blur(8px);
        opacity: 0.65;
        transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    }

    .debug-toggle-btn-top:hover {
        opacity: 1;
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(15, 23, 42, 0.25);
    }

    .debug-toggle-icon {
        display: inline-block;
        font-size: 1.1rem;
        line-height: 1;
        letter-spacing: 1px;
        font-weight: 600;
    }

    .debug-visual-panel-top {
        position: relative;
        width: 100%;
        height: 200px;
        background: #f8fafc;
        border: 1px solid var(--border);
        border-radius: 12px;
        margin-bottom: 1rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: slideDown 0.3s ease-out;
    }

    .debug-visual-panel-top.collapsed {
        height: 50px;
    }

    .debug-visual-panel-top.collapsed .debug-visual-content {
        display: none;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: scaleY(0);
            transform-origin: top;
        }
        to {
            opacity: 1;
            transform: scaleY(1);
        }
    }

    .debug-visual-header {
        background: linear-gradient(135deg, var(--primary), #8b5cf6);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px 10px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
    }

    .debug-visual-header h3 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 600;
    }

    .debug-header-link {
        background: rgba(255, 255, 255, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.28);
        color: white;
        padding: 0.4rem 0.9rem;
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.2s ease, transform 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        white-space: nowrap;
    }

    .debug-header-link:hover {
        background: rgba(255, 255, 255, 0.28);
        transform: translateY(-1px);
    }

    #debug-visual-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 1.5rem;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    }

    #debug-visual-close:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .debug-visual-content {
        padding: 1rem;
        overflow-y: auto;
        flex: 1;
        background: #f8fafc;
    }

    .debug-log {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .debug-entry {
        background: white;
        padding: 0.75rem;
        border-radius: 8px;
        border-left: 3px solid #cbd5e1;
        display: grid;
        grid-template-columns: auto auto 1fr;
        gap: 0.5rem;
        align-items: start;
        font-size: 0.85rem;
        transition: all 0.2s;
    }

    .debug-entry:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .debug-entry-success {
        border-left-color: #10b981;
        background: #f0fdf4;
    }

    .debug-entry-error {
        border-left-color: #ef4444;
        background: #fef2f2;
    }

    .debug-entry-warning {
        border-left-color: #f59e0b;
        background: #fffbeb;
    }

    .debug-entry-websocket {
        border-left-color: #6366f1;
        background: #eef2ff;
    }

    .debug-entry-message {
        border-left-color: #8b5cf6;
        background: #faf5ff;
    }

    .debug-time {
        color: #64748b;
        font-family: 'Courier New', monospace;
        font-size: 0.75rem;
        white-space: nowrap;
    }

    .debug-icon {
        font-size: 1rem;
    }

    .debug-msg {
        color: #0f172a;
        word-break: break-word;
    }

    .debug-data-small {
        grid-column: 1 / -1;
        background: #0f172a;
        color: #10b981;
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.7rem;
        margin-top: 0.25rem;
        overflow-x: auto;
    }
`;

const debugVisualStyleElement = document.createElement('style');
debugVisualStyleElement.textContent = debugVisualStyles;
document.head.appendChild(debugVisualStyleElement);

// Inicializar
window.addEventListener('load', () => {
    window.debugVisual = new DebugVisual();
    window.debugVisual.updateLayoutOffset();
});

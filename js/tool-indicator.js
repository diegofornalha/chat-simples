/**
 * Tool Indicator - Mostra ferramentas sendo usadas em tempo real
 *
 * Detecta quando Claude usa ferramentas (Read, Bash, etc) e exibe
 * visualmente para o usuário acompanhar o progresso.
 */

class ToolIndicator {
    constructor() {
        this.activeTools = new Map();
        this.toolHistory = [];
        this.panel = null;
        this.content = null;
        this.createIndicatorPanel();
    }

    createIndicatorPanel() {
        const panel = document.createElement('div');
        panel.id = 'tool-indicator-panel';
        panel.className = 'tool-indicator-panel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div class="tool-indicator-header">
                <span class="tool-indicator-title">🔧 Claude está usando ferramentas...</span>
                <div class="tool-indicator-spinner"></div>
            </div>
            <div class="tool-indicator-content" id="tool-indicator-content"></div>
        `;

        const typingIndicator = document.getElementById('typing-indicator');
        const parent = typingIndicator?.parentNode || document.body;
        parent.insertBefore(panel, typingIndicator || parent.firstChild);

        this.panel = panel;
        this.content = panel.querySelector('#tool-indicator-content');
    }

    show() {
        if (this.panel) {
            this.panel.style.display = 'flex';
        }
    }

    hide() {
        if (this.panel) {
            this.panel.style.display = 'none';
        }
        this.activeTools.clear();
        this.render();
    }

    addTool(toolName, action, toolUseId) {
        const id = toolUseId || `tool-${Date.now()}-${Math.random().toString(16).slice(2)}`;

        this.activeTools.set(id, {
            id,
            name: toolName,
            action: action || this.getToolDescription(toolName),
            status: 'running',
            startedAt: new Date().toISOString()
        });

        this.toolHistory.push({
            id,
            tool: toolName,
            action: action || this.getToolDescription(toolName),
            timestamp: new Date().toISOString()
        });

        this.render();
        this.show();
        window.debugSystem?.log('info', 'Tools', `Claude usando: ${toolName}`);

        return id;
    }

    updateTool(toolUseId, updates = {}) {
        const tool = this.activeTools.get(toolUseId);
        if (!tool) return;

        this.activeTools.set(toolUseId, {
            ...tool,
            ...updates
        });

        this.render();
    }

    removeTool(toolUseId) {
        if (this.activeTools.has(toolUseId)) {
            this.activeTools.delete(toolUseId);
        } else {
            // Fallback: remover por nome
            for (const [id, tool] of this.activeTools.entries()) {
                if (tool.name === toolUseId) {
                    this.activeTools.delete(id);
                }
            }
        }

        if (this.activeTools.size === 0) {
            setTimeout(() => this.hide(), 750);
        } else {
            this.render();
        }
    }

    render() {
        if (!this.content) return;

        this.content.innerHTML = Array.from(this.activeTools.values()).map(tool => {
            const icon = this.getToolIcon(tool.name);
            const statusClass = tool.status === 'error' ? 'tool-item error' : tool.status === 'done' ? 'tool-item success' : 'tool-item running';
            const statusText = tool.status === 'error' ? 'Falhou' : tool.status === 'done' ? 'Concluído' : 'Em andamento';

            return `
                <div class="${statusClass}" data-tool-id="${tool.id}">
                    <span class="tool-icon">${icon}</span>
                    <div class="tool-info">
                        <strong>${tool.name}</strong>
                        <small>${tool.action}</small>
                    </div>
                    <span class="tool-status-label">${statusText}</span>
                    <div class="tool-spinner"></div>
                </div>
            `;
        }).join('');

        this.content.querySelectorAll('.tool-item').forEach(item => {
            const toolId = item.getAttribute('data-tool-id');
            const tool = this.activeTools.get(toolId);
            if (!tool) return;

            const spinner = item.querySelector('.tool-spinner');
            if (spinner) {
                if (tool.status === 'running') {
                    spinner.style.display = 'block';
                } else {
                    spinner.style.display = 'none';
                }
            }
        });
    }

    getToolIcon(toolName) {
        const icons = {
            Read: '📖',
            Write: '✍️',
            Edit: '📝',
            Bash: '💻',
            Grep: '🔍',
            Glob: '📁',
            WebFetch: '🌐',
            Task: '🤖'
        };

        return icons[toolName] || '🔧';
    }

    getToolDescription(toolName) {
        const descriptions = {
            Read: 'Lendo arquivo...',
            Write: 'Escrevendo arquivo...',
            Edit: 'Editando código...',
            Bash: 'Executando comando...',
            Grep: 'Buscando no código...',
            Glob: 'Encontrando arquivos...',
            WebFetch: 'Consultando web...',
            Task: 'Executando subagente...'
        };

        return descriptions[toolName] || 'Processando...';
    }

    detectToolsInMessage(message) {
        if (!message) return;

        const toolPatterns = {
            Read: /reading|lendo arquivo|file at/i,
            Bash: /running command|executando|bash/i,
            Grep: /searching|buscando|grep/i,
            Write: /creating file|criando arquivo|write/i
        };

        for (const [tool, pattern] of Object.entries(toolPatterns)) {
            if (pattern.test(message)) {
                const id = this.addTool(tool, this.getToolDescription(tool));
                setTimeout(() => this.removeTool(id), 3000);
            }
        }
    }
}

const toolIndicatorStyles = `
    .tool-indicator-panel {
        background: var(--tool-indicator-bg, linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%));
        border-radius: 12px;
        padding: 1rem;
        margin: 0 1.5rem 1rem 1.5rem;
        flex-direction: column;
        gap: 0.75rem;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25);
        animation: slideDown 0.3s ease-out;
    }

    .tool-indicator-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .tool-indicator-title {
        color: white;
        font-weight: 600;
        font-size: 0.9rem;
    }

    .tool-indicator-spinner {
        width: 20px;
        height: 20px;
        border: 3px solid rgba(255, 255, 255, 0.25);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .tool-indicator-content {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .tool-item {
        border-radius: 10px;
        padding: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        backdrop-filter: blur(10px);
        background: rgba(15, 23, 42, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .tool-item.success {
        border-color: rgba(16, 185, 129, 0.4);
        background: rgba(16, 185, 129, 0.15);
    }

    .tool-item.error {
        border-color: rgba(239, 68, 68, 0.45);
        background: rgba(239, 68, 68, 0.15);
    }

    .tool-icon {
        font-size: 1.5rem;
    }

    .tool-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        color: white;
    }

    .tool-info small {
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.8rem;
    }

    .tool-status-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
    }

    .tool-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.25);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

const toolIndicatorStyleElement = document.createElement('style');
toolIndicatorStyleElement.textContent = toolIndicatorStyles;
document.head.appendChild(toolIndicatorStyleElement);

window.addEventListener('load', () => {
    window.toolIndicator = new ToolIndicator();
    console.log('🔧 Tool Indicator ativado');
});

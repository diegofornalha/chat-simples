/**
 * Tool Indicator - Mostra ferramentas sendo usadas em tempo real
 *
 * Detecta quando Claude usa ferramentas (Read, Bash, etc) e exibe
 * visualmente para o usuário acompanhar o progresso.
 */

class ToolIndicator {
    constructor() {
        this.activeTools = new Set();
        this.toolHistory = [];
        this.createIndicatorPanel();
    }

    createIndicatorPanel() {
        const panel = document.createElement('div');
        panel.id = 'tool-indicator-panel';
        panel.className = 'tool-indicator-panel';
        panel.style.display = 'none';  // Oculto por padrão
        panel.innerHTML = `
            <div class="tool-indicator-header">
                <span class="tool-indicator-title">🔧 Claude está usando ferramentas...</span>
                <div class="tool-indicator-spinner"></div>
            </div>
            <div class="tool-indicator-content" id="tool-indicator-content">
                <!-- Tools aparecem aqui -->
            </div>
        `;

        // Inserir antes do typing indicator
        const typingIndicator = document.getElementById('typing-indicator');
        typingIndicator.parentNode.insertBefore(panel, typingIndicator);
    }

    show() {
        const panel = document.getElementById('tool-indicator-panel');
        if (panel) {
            panel.style.display = 'flex';
        }
    }

    hide() {
        const panel = document.getElementById('tool-indicator-panel');
        if (panel) {
            panel.style.display = 'none';
        }
        this.activeTools.clear();
    }

    addTool(toolName, action) {
        this.activeTools.add(toolName);
        this.toolHistory.push({
            tool: toolName,
            action: action,
            timestamp: new Date().toISOString()
        });

        this.render();
        this.show();

        window.debugSystem?.log('info', 'Tools', `Claude usando: ${toolName} - ${action}`);
    }

    removeTool(toolName) {
        this.activeTools.delete(toolName);

        if (this.activeTools.size === 0) {
            setTimeout(() => this.hide(), 1000);
        } else {
            this.render();
        }
    }

    render() {
        const content = document.getElementById('tool-indicator-content');
        if (!content) return;

        content.innerHTML = Array.from(this.activeTools).map(tool => {
            const icon = this.getToolIcon(tool);
            const description = this.getToolDescription(tool);

            return `
                <div class="tool-item">
                    <span class="tool-icon">${icon}</span>
                    <div class="tool-info">
                        <strong>${tool}</strong>
                        <small>${description}</small>
                    </div>
                    <div class="tool-spinner"></div>
                </div>
            `;
        }).join('');
    }

    getToolIcon(toolName) {
        const icons = {
            'Read': '📖',
            'Write': '✍️',
            'Edit': '📝',
            'Bash': '💻',
            'Grep': '🔍',
            'Glob': '📁',
            'WebFetch': '🌐',
            'Task': '🤖',
        };

        return icons[toolName] || '🔧';
    }

    getToolDescription(toolName) {
        const descriptions = {
            'Read': 'Lendo arquivo...',
            'Write': 'Escrevendo arquivo...',
            'Edit': 'Editando código...',
            'Bash': 'Executando comando...',
            'Grep': 'Buscando no código...',
            'Glob': 'Encontrando arquivos...',
            'WebFetch': 'Consultando web...',
            'Task': 'Executando subagent...',
        };

        return descriptions[toolName] || 'Processando...';
    }

    // Simular detecção de ferramentas (via parsing de mensagens)
    detectToolsInMessage(message) {
        const toolPatterns = {
            'Read': /reading|lendo arquivo|file at/i,
            'Bash': /running command|executando|bash/i,
            'Grep': /searching|buscando|grep/i,
            'Write': /creating file|criando arquivo|write/i,
        };

        for (const [tool, pattern] of Object.entries(toolPatterns)) {
            if (pattern.test(message)) {
                this.addTool(tool, this.getToolDescription(tool));

                // Remover após 3 segundos
                setTimeout(() => this.removeTool(tool), 3000);
            }
        }
    }
}

// CSS para tool indicator
const toolIndicatorStyles = `
    .tool-indicator-panel {
        background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
        border-radius: 12px;
        padding: 1rem;
        margin: 0 1.5rem 1rem 1.5rem;
        flex-direction: column;
        gap: 0.75rem;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
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
        border: 3px solid rgba(255, 255, 255, 0.3);
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
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        backdrop-filter: blur(10px);
    }

    .tool-icon {
        font-size: 1.5rem;
    }

    .tool-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .tool-info strong {
        color: white;
        font-size: 0.9rem;
    }

    .tool-info small {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.8rem;
    }

    .tool-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
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

// Inicializar
window.addEventListener('load', () => {
    window.toolIndicator = new ToolIndicator();
    console.log('🔧 Tool Indicator ativado');
});

/**
 * Autosave System - Persistência local de conversas
 */

class AutosaveSystem {
    constructor(chatApp) {
        this.app = chatApp;
        this.saveInterval = 10000; // 10 segundos
        this.storageKey = 'claude_chat_conversations';

        this.init();
    }

    init() {
        // Carregar conversas salvas ao iniciar
        this.loadSavedConversations();

        // Autosave a cada 10 segundos
        setInterval(() => this.save(), this.saveInterval);

        // Salvar antes de fechar janela
        window.addEventListener('beforeunload', () => this.save());

        // Adicionar botão de restaurar
        this.addRestoreButton();

        console.log('💾 Autosave System ativado (salva a cada 10s)');
    }

    save() {
        try {
            // Coletar todas as mensagens do DOM
            const messages = [];
            document.querySelectorAll('.message').forEach(msgDiv => {
                const role = msgDiv.classList.contains('user') ? 'user' : 'assistant';
                const content = msgDiv.querySelector('.message-content')?.textContent || '';
                const timestamp = msgDiv.querySelector('.timestamp')?.textContent || '';

                if (content && content !== "Olá! 👋 Sou o Claude, rodando via ") { // Skip welcome
                    messages.push({
                        role,
                        content: content.trim(),
                        timestamp
                    });
                }
            });

            if (messages.length === 0) return;

            // Salvar no localStorage
            const data = {
                conversationId: this.app.conversationId,
                messages,
                totalCost: this.app.totalCost,
                messageCount: this.app.messageCount,
                savedAt: new Date().toISOString()
            };

            localStorage.setItem(this.storageKey, JSON.stringify(data));

            window.debugSystem?.log('info', 'Autosave', `${messages.length} mensagens salvas`);

        } catch (error) {
            console.error('Erro ao salvar:', error);
            window.debugSystem?.log('error', 'Autosave', 'Falha ao salvar', { error: error.message });
        }
    }

    loadSavedConversations() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (!saved) return;

            const data = JSON.parse(saved);

            // Verificar se conversa é recente (< 24h)
            const savedAt = new Date(data.savedAt);
            const hoursSince = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);

            if (hoursSince > 24) {
                console.log('📦 Conversa salva muito antiga (> 24h), ignorando');
                return;
            }

            // Desabilitado: popup de restauração automática
            // Usuário pode usar Ctrl+O para abrir conversas salvas manualmente
            console.log(`💾 Conversa salva disponível: ${data.messageCount} mensagens | $${data.totalCost.toFixed(4)}`);
            // Auto-restore desabilitado para não incomodar
            // this.restore(data);

        } catch (error) {
            console.error('Erro ao carregar:', error);
        }
    }

    restore(data) {
        // Restaurar conversation ID
        this.app.conversationId = data.conversationId;
        this.app.totalCost = data.totalCost || 0;
        this.app.messageCount = data.messageCount || 0;

        // Limpar mensagens atuais
        const messagesContainer = document.getElementById('messages');
        messagesContainer.innerHTML = '';

        // Restaurar mensagens
        data.messages.forEach(msg => {
            const messageDiv = this.app.createMessageElement(msg.role, msg.content);
            messagesContainer.appendChild(messageDiv);
        });

        // Atualizar UI
        this.app.updateMessageCount();
        this.app.scrollToBottom();

        console.log(`✅ ${data.messages.length} mensagens restauradas`);
        window.debugSystem?.log('success', 'Autosave', `Conversa restaurada: ${data.messageCount} msgs`);

        // Limpar do storage
        localStorage.removeItem(this.storageKey);
    }

    addRestoreButton() {
        // Verificar se tem conversa salva
        const saved = localStorage.getItem(this.storageKey);
        if (!saved) return;

        const button = document.createElement('button');
        button.className = 'restore-hint';
        button.innerHTML = '💾 Restaurar conversa salva';
        button.onclick = () => {
            const data = JSON.parse(saved);
            this.restore(data);
            button.remove();
        };

        document.querySelector('.chat-header').appendChild(button);
    }

    formatTimeSince(date) {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

        if (seconds < 60) return `${seconds}s atrás`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}min atrás`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
        return `${Math.floor(seconds / 86400)}d atrás`;
    }

    clearSaved() {
        localStorage.removeItem(this.storageKey);
        console.log('🗑️ Conversa salva removida');
    }
}

// CSS para restore button
const autosaveStyles = `
    .restore-hint {
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--success);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        animation: slideDown 0.3s ease-out;
        z-index: 2000;
    }

    .restore-hint:hover {
        transform: translateX(-50%) translateY(-2px);
        box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
`;

const autosaveStyleElement = document.createElement('style');
autosaveStyleElement.textContent = autosaveStyles;
document.head.appendChild(autosaveStyleElement);

// Inicializar
window.addEventListener('load', () => {
    if (window.chatApp) {
        window.autosaveSystem = new AutosaveSystem(window.chatApp);
    }
});

/**
 * Keyboard Shortcuts para Claude Chat
 * Aumenta produtividade do usuário
 */

class KeyboardShortcuts {
    constructor(chatApp) {
        this.app = chatApp;
        this.shortcuts = {
            // Navegação
            'Escape': {
                action: () => this.clearInput(),
                description: 'Limpar input'
            },
            'Control+K': {
                action: () => showTemplates(),
                description: 'Abrir templates'
            },
            'Control+/': {
                action: () => this.showHelp(),
                description: 'Mostrar atalhos'
            },

            // Ações
            'Control+E': {
                action: () => this.app.exportConversation(),
                description: 'Exportar conversa'
            },
            'Control+Shift+C': {
                action: () => this.app.clearChat(),
                description: 'Limpar chat'
            },
            'Control+Shift+D': {
                action: () => window.debugSystem?.toggle(),
                description: 'Toggle debug panel'
            },

            // Produtividade
            'Control+1': {
                action: () => this.insertTemplate(0),
                description: 'Template rápido 1'
            },
            'Control+2': {
                action: () => this.insertTemplate(1),
                description: 'Template rápido 2'
            },
            'Control+3': {
                action: () => this.insertTemplate(2),
                description: 'Template rápido 3'
            }
        };

        this.quickTemplates = [
            "Explique de forma simples: ",
            "Escreva código Python para: ",
            "Analise este código:\n\n```\n\n```"
        ];

        this.init();
    }

    init() {
        document.addEventListener('keydown', (e) => {
            const key = this.getKeyCombo(e);

            if (this.shortcuts[key]) {
                e.preventDefault();
                this.shortcuts[key].action();
                window.debugSystem?.log('info', 'Shortcuts', `Atalho usado: ${key}`);
            }
        });

        // Mostrar indicador de shortcuts
        this.showShortcutHint();
    }

    getKeyCombo(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('Control');
        if (e.shiftKey) parts.push('Shift');
        if (e.altKey) parts.push('Alt');

        if (e.key !== 'Control' && e.key !== 'Shift' && e.key !== 'Alt') {
            parts.push(e.key);
        }

        return parts.join('+');
    }

    clearInput() {
        this.app.messageInput.value = '';
        this.app.messageInput.focus();
    }

    insertTemplate(index) {
        if (index < this.quickTemplates.length) {
            this.app.messageInput.value = this.quickTemplates[index];
            this.app.messageInput.focus();
        }
    }

    showHelp() {
        const modal = document.createElement('div');
        modal.className = 'modal';

        let shortcutsHTML = '';
        for (const [key, data] of Object.entries(this.shortcuts)) {
            shortcutsHTML += `
                <div class="shortcut-item">
                    <kbd class="shortcut-key">${key.replace(/Control/g, 'Ctrl')}</kbd>
                    <span class="shortcut-desc">${data.description}</span>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>⌨️ Atalhos de Teclado</h2>
                    <button class="modal-close">✕</button>
                </div>
                <div class="modal-body">
                    <div class="shortcuts-grid">
                        ${shortcutsHTML}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.modal-close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    showShortcutHint() {
        // Adicionar hint sutil no footer
        const footer = document.querySelector('.chat-footer .footer-info');

        const hint = document.createElement('span');
        hint.innerHTML = '<small style="opacity: 0.5;">Ctrl+/ para atalhos</small>';

        footer.appendChild(hint);
    }
}

// CSS para shortcuts
const shortcutsStyles = `
    .shortcuts-grid {
        display: grid;
        gap: 0.75rem;
    }

    .shortcut-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem;
        background: var(--bg-hover);
        border-radius: 8px;
    }

    .shortcut-key {
        background: var(--bg-dark);
        padding: 0.25rem 0.75rem;
        border-radius: 6px;
        border: 1px solid var(--border);
        font-family: 'Courier New', monospace;
        font-size: 0.85rem;
        color: var(--primary);
        min-width: 120px;
        text-align: center;
    }

    .shortcut-desc {
        color: var(--text-primary);
        font-size: 0.9rem;
    }
`;

const shortcutsStyleElement = document.createElement('style');
shortcutsStyleElement.textContent = shortcutsStyles;
document.head.appendChild(shortcutsStyleElement);

// Inicializar quando app estiver pronto
window.addEventListener('load', () => {
    if (window.chatApp) {
        window.shortcuts = new KeyboardShortcuts(window.chatApp);
        console.log('⌨️ Keyboard Shortcuts ativados');
    }
});

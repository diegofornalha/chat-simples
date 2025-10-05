// Claude Chat - Frontend Application
// Conecta via WebSocket e exibe streaming em tempo real

class ClaudeChatApp {
    constructor() {
        this.ws = null;
        this.conversationId = null;
        this.currentMessage = null;
        this.messageCount = 0;
        this.totalCost = 0;

        // Response timer
        this.responseStartTime = null;
        this.responseTimerInterval = null;

        // DOM elements
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.messagesContainer = document.getElementById('messages');
        this.typingIndicator = document.getElementById('typing-indicator');
        this.responseTimer = document.getElementById('response-timer');
        this.statusIndicator = document.getElementById('status');
        this.messageCountDisplay = document.getElementById('message-count');

        // Configurar marked.js para markdown
        marked.setOptions({
            highlight: function(code, lang) {
                if (lang && hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
                return hljs.highlightAuto(code).value;
            },
            breaks: true,
            gfm: true
        });

        this.init();
    }

    init() {
        // Conectar WebSocket
        this.connectWebSocket();

        // Event listeners
        this.sendButton.addEventListener('click', () => this.sendMessage());

        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
        });
    }

    connectWebSocket() {
        const wsUrl = 'ws://localhost:8080/ws/chat';

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket conectado');
            this.updateStatus('connected');
            window.debugVisual?.log('websocket', `Conectado: ${wsUrl}`);
        };

        this.ws.onclose = () => {
            console.log('❌ WebSocket desconectado');
            this.updateStatus('disconnected');
            window.debugVisual?.log('warning', 'WebSocket desconectado - reconectando em 3s');

            // Tentar reconectar após 3s
            setTimeout(() => {
                console.log('🔄 Tentando reconectar...');
                this.connectWebSocket();
            }, 3000);
        };

        this.ws.onerror = (error) => {
            console.error('❌ Erro no WebSocket:', error);
            window.debugVisual?.log('error', `Erro WebSocket: ${error.message || 'Conexão falhou'}`);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };
    }

    updateStatus(status) {
        this.statusIndicator.className = `status ${status}`;
        this.statusIndicator.textContent = status === 'connected' ? '🟢 Conectado' : '⚫ Desconectado';
    }

    sendMessage() {
        const message = this.messageInput.value.trim();

        if (!message || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        // Adicionar mensagem do usuário ao DOM
        this.addUserMessage(message);

        // Enviar via WebSocket
        const payload = {
            message: message,
            conversation_id: this.conversationId
        };
        this.ws.send(JSON.stringify(payload));
        window.debugVisual?.log('message', `📤 Enviado (${message.substring(0, 30)}...)`, {
            conversation_id: this.conversationId || 'nova conversa'
        });

        // Limpar input
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.messageInput.focus();

        // Mostrar typing indicator
        this.showTypingIndicator();

        // Desabilitar botão
        this.sendButton.disabled = true;
    }

    handleServerMessage(data) {
        const type = data.type;

        switch (type) {
            case 'user_message_saved':
                this.conversationId = data.conversation_id;
                console.log(`💾 Mensagem salva na conversa ${this.conversationId}`);
                window.debugVisual?.log('success', `💾 Conversation ID: ${this.conversationId.substring(0, 8)}...`);
                break;

            case 'text_chunk':
                // Streaming de texto
                this.appendToCurrentMessage(data.content);
                break;

            case 'thinking':
                // Pensamento do Claude
                this.showThinking(data.content);
                window.debugVisual?.log('info', `💭 Thinking... (${data.content.substring(0, 30)}...)`);
                break;

            case 'result':
                // Resposta completa
                this.finalizeMessage(data);
                window.debugVisual?.log('success', `✅ Resposta completa`, {
                    tokens: data.cost ? `$${data.cost.toFixed(4)}` : 'N/A',
                    duration: data.duration_ms ? `${data.duration_ms}ms` : 'N/A',
                    turns: data.num_turns || 'N/A'
                });
                break;

            case 'error':
                this.showError(data.error);
                window.debugVisual?.log('error', `❌ Erro: ${data.error}`);
                break;

            default:
                console.log('Tipo de mensagem desconhecido:', type, data);
        }
    }

    addUserMessage(content) {
        const messageDiv = this.createMessageElement('user', content);
        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        this.messageCount++;
        this.updateMessageCount();
    }

    showTypingIndicator() {
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();

        // Iniciar contador de tempo
        this.startResponseTimer();
    }

    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';

        // Parar contador
        this.stopResponseTimer();
    }

    startResponseTimer() {
        this.responseStartTime = Date.now();

        // Atualizar a cada 100ms
        this.responseTimerInterval = setInterval(() => {
            const elapsed = (Date.now() - this.responseStartTime) / 1000;
            if (this.responseTimer) {
                this.responseTimer.textContent = `${elapsed.toFixed(1)}s`;

                // Mudar cor baseado no tempo
                if (elapsed > 10) {
                    this.responseTimer.style.color = '#ef4444';  // Vermelho se > 10s
                } else if (elapsed > 5) {
                    this.responseTimer.style.color = '#f59e0b';  // Amarelo se > 5s
                } else {
                    this.responseTimer.style.color = '#10b981';  // Verde se < 5s
                }
            }
        }, 100);
    }

    stopResponseTimer() {
        if (this.responseTimerInterval) {
            clearInterval(this.responseTimerInterval);
            this.responseTimerInterval = null;
        }

        // Salvar tempo final para métricas
        if (this.responseStartTime) {
            const finalTime = Date.now() - this.responseStartTime;
            window.debugSystem?.log('info', 'Performance', `Tempo de resposta: ${finalTime}ms`);
        }

        this.responseStartTime = null;
    }

    appendToCurrentMessage(chunk) {
        // Criar mensagem do assistant se não existir
        if (!this.currentMessage) {
            this.hideTypingIndicator();

            this.currentMessage = document.createElement('div');
            this.currentMessage.className = 'message assistant';

            const header = document.createElement('div');
            header.className = 'message-header';
            header.innerHTML = `
                <strong>🤖 Claude</strong>
                <span class="timestamp">${this.formatTime(new Date())}</span>
            `;

            const content = document.createElement('div');
            content.className = 'message-content';

            this.currentMessage.appendChild(header);
            this.currentMessage.appendChild(content);
            this.messagesContainer.appendChild(this.currentMessage);
        }

        // Adicionar chunk ao conteúdo
        const contentDiv = this.currentMessage.querySelector('.message-content');
        const currentText = contentDiv.textContent || '';
        const newText = currentText + chunk;

        // Renderizar markdown
        contentDiv.innerHTML = marked.parse(newText);

        // Syntax highlighting
        contentDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        this.scrollToBottom();
    }

    finalizeMessage(data) {
        this.hideTypingIndicator();

        // Finalizar mensagem atual
        if (this.currentMessage) {
            const contentDiv = this.currentMessage.querySelector('.message-content');
            contentDiv.innerHTML = marked.parse(data.content || '');

            // Syntax highlighting
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });

            // Adicionar botão de copiar em code blocks
            this.addCopyButtons(contentDiv);

            this.currentMessage = null;
        }

        // Atualizar estatísticas
        if (data.cost !== null && data.cost !== undefined) {
            this.totalCost += data.cost;
            // Cost display removido do UI (trackeia internamente para metrics)
        }

        this.messageCount++;
        this.updateMessageCount();

        // Notificar se janela não estiver em foco
        if (!document.hasFocus() && window.notificationSystem) {
            window.notificationSystem.notifyResponse(full_content);
        }

        // Record metrics
        if (window.performanceMetrics) {
            window.performanceMetrics.recordMessage(
                data.duration_ms,
                data.cost,
                1,  // chunks (aproximado)
                data.is_error
            );
        }

        // Re-habilitar botão
        this.sendButton.disabled = false;
        this.messageInput.focus();
        this.scrollToBottom();

        // Mostrar erro se houver
        if (data.is_error) {
            this.showError("Claude retornou um erro na execução");
        }
    }

    showThinking(thinking) {
        if (!this.currentMessage) {
            return;
        }

        const contentDiv = this.currentMessage.querySelector('.message-content');

        // Criar bloco de thinking se não existir
        let thinkingBlock = contentDiv.querySelector('.thinking-block');
        if (!thinkingBlock) {
            thinkingBlock = document.createElement('div');
            thinkingBlock.className = 'thinking-block';
            contentDiv.insertBefore(thinkingBlock, contentDiv.firstChild);
        }

        thinkingBlock.innerHTML = `💭 <em>Pensando: ${thinking}</em>`;
        this.scrollToBottom();
    }

    showError(error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant error-message';
        errorDiv.innerHTML = `
            <div class="message-header">
                <strong>❌ Erro</strong>
                <span class="timestamp">${this.formatTime(new Date())}</span>
            </div>
            <div class="message-content">
                <p>${error}</p>
            </div>
        `;

        this.messagesContainer.appendChild(errorDiv);
        this.hideTypingIndicator();
        this.sendButton.disabled = false;
        this.scrollToBottom();
    }

    createMessageElement(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <strong>${role === 'user' ? '👤 Você' : '🤖 Claude'}</strong>
            <span class="timestamp">${this.formatTime(new Date())}</span>
        `;

        // Adicionar botão de copiar na mensagem do Claude
        if (role === 'assistant') {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-message-btn';
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Copiar mensagem';
            copyBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(content);
                copyBtn.innerHTML = '✅';
                setTimeout(() => { copyBtn.innerHTML = '📋'; }, 2000);
            };
            header.appendChild(copyBtn);
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (role === 'user') {
            contentDiv.textContent = content;
        } else {
            contentDiv.innerHTML = marked.parse(content);
            // Syntax highlighting
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        messageDiv.appendChild(header);
        messageDiv.appendChild(contentDiv);

        return messageDiv;
    }

    addCopyButtons(contentDiv) {
        contentDiv.querySelectorAll('pre').forEach((pre) => {
            // Verificar se já tem botão
            if (pre.querySelector('.copy-code-btn')) {
                return;
            }

            const button = document.createElement('button');
            button.className = 'copy-code-btn';
            button.textContent = '📋 Copiar';

            button.addEventListener('click', () => {
                const code = pre.querySelector('code').textContent;
                navigator.clipboard.writeText(code);

                button.textContent = '✅ Copiado!';
                button.classList.add('copied');

                setTimeout(() => {
                    button.textContent = '📋 Copiar';
                    button.classList.remove('copied');
                }, 2000);
            });

            // Inserir botão
            const header = document.createElement('div');
            header.className = 'code-header';
            header.appendChild(button);

            pre.parentNode.insertBefore(header, pre);
        });
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    updateMessageCount() {
        this.messageCountDisplay.textContent = `${this.messageCount} mensagens`;
    }

    clearChat() {
        if (!confirm('Limpar todo o histórico do chat?')) {
            return;
        }

        // Limpar mensagens (manter boas-vindas)
        const welcomeMessage = this.messagesContainer.querySelector('.message.assistant');
        this.messagesContainer.innerHTML = '';
        if (welcomeMessage) {
            this.messagesContainer.appendChild(welcomeMessage);
        }

        // Reset
        this.conversationId = null;
        this.currentMessage = null;
        this.messageCount = 0;
        this.totalCost = 0;

        this.updateMessageCount();
    }

    formatTime(date) {
        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async exportConversation() {
        if (!this.conversationId) {
            alert('⚠️ Nenhuma conversa para exportar');
            return;
        }

        try {
            const response = await fetch(`http://localhost:8080/conversations/${this.conversationId}/export`);
            const data = await response.json();

            if (data.error) {
                alert(`❌ Erro: ${data.error}`);
                return;
            }

            // Download do arquivo MD
            const blob = new Blob([data.markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            a.click();
            URL.revokeObjectURL(url);

            window.debugSystem?.log('success', 'Export', `Conversa exportada: ${data.filename}`);
            alert(`✅ Conversa exportada como ${data.filename}`);

        } catch (error) {
            console.error('Erro ao exportar:', error);
            window.debugSystem?.log('error', 'Export', 'Falha ao exportar', { error: error.message });
            alert(`❌ Erro ao exportar: ${error.message}`);
        }
    }
}

// Inicializar app quando DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando Claude Chat App...');
    window.chatApp = new ClaudeChatApp();
});

const STORAGE_KEY = 'claude_chat_history_v1';
const MAX_HISTORY_ITEMS = 200;
const THEME_KEY = 'claude_chat_theme';

function escapeHtml(text = '') {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeHtml(html) {
    if (!html) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll('script, iframe, object, embed, link, style').forEach(el => el.remove());

    doc.body.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            const name = attr.name.toLowerCase();
            const value = (attr.value || '').trim().toLowerCase();
            if (name.startsWith('on') || value.startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });

    return doc.body.innerHTML;
}

function renderMarkdownSafe(text) {
    if (!text) return '';

    if (window.marked) {
        const raw = marked.parse(text);
        return sanitizeHtml(raw);
    }

    return escapeHtml(text).replace(/\n/g, '<br>');
}

function truncateText(text, maxLength = 160) {
    if (!text) return '';
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return normalized.slice(0, maxLength - 1) + '…';
}

function safeStringify(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch (err) {
        return String(value);
    }
}

function normalizeTimestamp(value) {
    if (!value) return new Date();
    try {
        return value instanceof Date ? value : new Date(value);
    } catch (err) {
        return new Date();
    }
}

class ClaudeChatApp {
    constructor() {
        this.ws = null;
        this.conversationId = null;
        this.localConversationId = null;
        this.currentMessage = null;
        this.currentMessageContent = null;
        this.messageCount = 0;
        this.totalCost = 0;
        this.localHistory = [];
        this.pendingAssistantContent = '';
        this.currentChunkCount = 0;
        this.toolActivities = new Map();
        this.shouldAutoScroll = true;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 6;
        this.reconnectTimer = null;
        this.connectionState = 'disconnected';
        this.hasConnectedOnce = false;
        this.manualTheme = null;

        this.responseStartTime = null;
        this.responseTimerInterval = null;

        this.cacheDom();
        this.setupMarkdown();
        this.setupTheme();
        this.attachEvents();
        this.autoResizeInput();
        this.restoreHistory();
        this.connectWebSocket();
    }

    cacheDom() {
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.messagesContainer = document.getElementById('messages');
        this.initialMessagesSnapshot = this.messagesContainer ? this.messagesContainer.innerHTML : '';
        this.typingIndicator = document.getElementById('typing-indicator');
        this.responseTimer = document.getElementById('response-timer');
        this.statusIndicator = document.getElementById('status');
        this.messageCountDisplay = document.getElementById('message-count');
        this.themeToggle = document.getElementById('theme-toggle');
    }

    setupMarkdown() {
        if (window.marked) {
            marked.setOptions({
                gfm: true,
                breaks: true,
                highlight(code, lang) {
                    if (window.hljs) {
                        if (lang && hljs.getLanguage(lang)) {
                            return hljs.highlight(code, { language: lang }).value;
                        }
                        return hljs.highlightAuto(code).value;
                    }
                    return code;
                }
            });
        }
    }

    setupTheme() {
        this.setTheme('light', false);
    }

    setTheme(theme, persist = true) {
        document.documentElement.dataset.theme = theme;
        this.manualTheme = theme;
    }

    toggleTheme() {}

    attachEvents() {
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.sendMessage());
        }

        if (this.messageInput) {
            this.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            this.messageInput.addEventListener('input', () => this.autoResizeInput());
        }

        if (this.messagesContainer) {
            this.messagesContainer.addEventListener('scroll', () => {
                const { scrollTop, scrollHeight, clientHeight } = this.messagesContainer;
                this.shouldAutoScroll = scrollTop + clientHeight >= scrollHeight - 120;
            });
        }

        const newChatBtn = document.getElementById('new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.startNewChat());
        }

        const refreshBtn = document.getElementById('refresh-button');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => window.location.reload());
        }

        window.addEventListener('focus', () => {
            window.notificationSystem?.clearBadge();
        });
    }

    autoResizeInput() {
        if (!this.messageInput) return;
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = `${Math.min(this.messageInput.scrollHeight, 240)}px`;
    }

    connectWebSocket() {
        const wsUrl = 'ws://localhost:8080/ws/chat';

        if (this.ws) {
            try {
                this.ws.close();
            } catch (err) {
                console.warn('Failed to close previous WebSocket', err);
            }
        }

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.updateStatus('connecting');

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            const wasReconnecting = this.hasConnectedOnce && this.connectionState === 'disconnected';
            this.hasConnectedOnce = true;
            this.reconnectAttempts = 0;
            this.updateStatus('connected');
            this.sendButton && (this.sendButton.disabled = false);
            window.debugVisual?.log('websocket', `Conectado: ${wsUrl}`);
            if (wasReconnecting) {
                this.showSystemMessage('Reconectado com sucesso');
            }
        };

        this.ws.onclose = () => {
            const shouldReconnect = this.reconnectAttempts < this.maxReconnectAttempts;
            this.updateStatus('disconnected');
            this.sendButton && (this.sendButton.disabled = false);

            if (this.hasConnectedOnce) {
                window.debugVisual?.log('warning', 'WebSocket desconectado');
                this.showSystemMessage('Conexão perdida. Tentando reconectar...');
            }

            if (shouldReconnect) {
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 15000);
                this.reconnectAttempts += 1;
                this.reconnectTimer = setTimeout(() => {
                    window.debugVisual?.log('info', `🔄 Tentativa de reconexão (${this.reconnectAttempts})`);
                    this.connectWebSocket();
                }, delay);
            } else if (this.hasConnectedOnce) {
                this.showSystemMessage('Não foi possível reconectar automaticamente. Verifique o servidor.');
            }
        };

        this.ws.onerror = (error) => {
            console.error('❌ Erro no WebSocket:', error);
            window.debugVisual?.log('error', `Erro WebSocket: ${error.message || 'Conexão falhou'}`);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (err) {
                console.error('Erro ao processar mensagem:', err);
                window.debugVisual?.log('error', 'Falha ao parsear mensagem do servidor');
            }
        };
    }

    updateStatus(state) {
        this.connectionState = state;

        if (!this.statusIndicator) return;

        this.statusIndicator.classList.remove('connected', 'disconnected');

        switch (state) {
            case 'connected':
                this.statusIndicator.classList.add('connected');
                this.statusIndicator.textContent = '🟢';
                break;
            case 'connecting':
                this.statusIndicator.textContent = '🟡';
                break;
            default:
                this.statusIndicator.classList.add('disconnected');
                this.statusIndicator.textContent = '⚫';
                break;
        }
    }

    handleServerMessage(data) {
        const { type } = data;

        switch (type) {
            case 'user_message_saved':
                this.conversationId = data.conversation_id;
                this.localConversationId = data.conversation_id;
                this.saveLocalHistory();
                window.debugVisual?.log('success', `💾 Conversation ID: ${String(this.conversationId).slice(0, 8)}...`);
                break;

            case 'text_chunk':
                this.appendToCurrentMessage(data.content || '');
                break;

            case 'thinking':
                this.showThinking(data.content || '');
                window.debugVisual?.log('info', `💭 Thinking... (${(data.content || '').slice(0, 30)}...)`);
                break;

            case 'result':
                this.finalizeMessage(data);
                window.debugVisual?.log('success', '✅ Resposta completa', {
                    tokens: data.cost ? `$${data.cost.toFixed(4)}` : 'N/A',
                    duration: data.duration_ms ? `${data.duration_ms}ms` : 'N/A',
                    turns: data.num_turns || 'N/A'
                });
                break;

            case 'error':
                this.showError(data.error || 'Erro desconhecido');
                window.debugVisual?.log('error', `❌ Erro: ${data.error || 'Sem detalhes'}`);
                break;

            case 'tool_start':
            case 'tool_result':
                this.handleToolEvent(data);
                break;

            default:
                console.log('Tipo de mensagem desconhecido:', type, data);
        }
    }

    sendMessage() {
        if (!this.messageInput || !this.ws) return;

        const message = this.messageInput.value.trim();
        if (!message || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        this.addUserMessage(message);

        const payload = {
            message,
            conversation_id: this.conversationId
        };

        this.ws.send(JSON.stringify(payload));
        window.debugVisual?.log('message', `📤 Enviado (${message.substring(0, 30)}...)`, {
            conversation_id: this.conversationId || 'nova conversa'
        });

        window.toolIndicator?.detectToolsInMessage(message);

        this.messageInput.value = '';
        this.autoResizeInput();
        this.messageInput.focus();

        this.showTypingIndicator();
        if (this.sendButton) {
            this.sendButton.disabled = true;
        }

        this.pendingAssistantContent = '';
        this.currentChunkCount = 0;
    }

    addUserMessage(content) {
        const messageDiv = this.createMessageElement('user', content, new Date());
        this.messagesContainer?.appendChild(messageDiv);
        this.messageCount += 1;
        this.updateMessageCount();
        this.scrollToBottom({ behavior: 'smooth' });
        this.saveMessage('user', content, { timestamp: new Date().toISOString() });
    }

    ensureAssistantMessage() {
        if (this.currentMessage && this.currentMessageContent) {
            return this.currentMessage;
        }

        const { messageDiv, contentDiv } = this.buildMessageElement('assistant', new Date());
        this.messagesContainer?.appendChild(messageDiv);
        this.currentMessage = messageDiv;
        this.currentMessageContent = contentDiv;
        this.hideTypingIndicator();
        this.scrollToBottom({ force: true, behavior: 'auto' });
        return messageDiv;
    }

    appendToCurrentMessage(chunk = '') {
        const trimmedChunk = chunk ?? '';
        if (!trimmedChunk) {
            this.ensureAssistantMessage();
            return;
        }

        const messageEl = this.ensureAssistantMessage();
        const contentDiv = this.currentMessageContent || messageEl.querySelector('.message-content');
        if (!contentDiv) return;

        this.pendingAssistantContent = `${this.pendingAssistantContent}${trimmedChunk}`;
        contentDiv.innerHTML = renderMarkdownSafe(this.pendingAssistantContent);

        this.currentChunkCount = (this.currentChunkCount || 0) + 1;

        this.scrollToBottom({ behavior: 'smooth' });
    }

    finalizeMessage(data) {
        this.hideTypingIndicator();

        const finalText = data.content ?? this.pendingAssistantContent ?? '';
        const messageEl = this.currentMessage || this.ensureAssistantMessage();
        const contentDiv = this.currentMessageContent || messageEl.querySelector('.message-content');

        if (contentDiv) {
            contentDiv.innerHTML = renderMarkdownSafe(finalText);
            this.highlightCode(contentDiv);
            this.addCopyButtons(contentDiv);
            this.enhanceCodeBlocks(contentDiv);
        }

        this.attachCopyButton(messageEl, finalText);

        if (data.thinking && contentDiv && !contentDiv.querySelector('.thinking-block')) {
            const thinkingBlock = document.createElement('div');
            thinkingBlock.className = 'thinking-block';
            thinkingBlock.innerHTML = `💭 <em>${escapeHtml(data.thinking)}</em>`;
            contentDiv.prepend(thinkingBlock);
        }

        if (typeof data.cost === 'number') {
            this.totalCost += data.cost;
        }

        this.messageCount += 1;
        this.updateMessageCount();

        if (!document.hasFocus() && window.notificationSystem) {
            window.notificationSystem.notifyResponse(finalText);
        }

        if (window.performanceMetrics) {
            window.performanceMetrics.recordMessage(
                data.duration_ms,
                data.cost,
                this.currentChunkCount || 1,
                data.is_error
            );
        }

        this.saveMessage('assistant', finalText, {
            timestamp: new Date().toISOString(),
            thinking: data.thinking
        });

        if (this.sendButton) {
            this.sendButton.disabled = false;
        }
        this.messageInput?.focus();
        this.scrollToBottom({ behavior: 'smooth' });

        if (data.is_error) {
            const errorMessage = data.error || 'Claude retornou um erro durante a execução.';
            this.showError(errorMessage);
        }

        this.currentMessage = null;
        this.currentMessageContent = null;
        this.pendingAssistantContent = '';
        this.currentChunkCount = 0;
    }

    showThinking(thinkingChunk = '') {
        if (!thinkingChunk) return;

        const messageEl = this.ensureAssistantMessage();
        const contentDiv = this.currentMessageContent || messageEl.querySelector('.message-content');
        if (!contentDiv) return;

        let thinkingBlock = contentDiv.querySelector('.thinking-block');
        if (!thinkingBlock) {
            thinkingBlock = document.createElement('div');
            thinkingBlock.className = 'thinking-block';
            thinkingBlock.dataset.content = '';
            contentDiv.prepend(thinkingBlock);
        }

        const accumulated = `${thinkingBlock.dataset.content || ''}${thinkingChunk}`;
        thinkingBlock.dataset.content = accumulated;
        thinkingBlock.innerHTML = `💭 <em>${escapeHtml(accumulated)}</em>`;
        this.scrollToBottom({ behavior: 'smooth' });
    }

    showError(error) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';

        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <strong>❌ Erro</strong>
            <div class="message-meta">
                <span class="timestamp">${this.formatTime(new Date())}</span>
            </div>
        `;

        const content = document.createElement('div');
        content.className = 'message-content';
        content.innerHTML = `<p>${escapeHtml(error)}</p>`;

        messageDiv.appendChild(header);
        messageDiv.appendChild(content);

        this.messagesContainer?.appendChild(messageDiv);
        this.hideTypingIndicator();
        this.sendButton && (this.sendButton.disabled = false);
        this.scrollToBottom({ behavior: 'smooth' });
    }

    showSystemMessage(text) {
        if (!text) return;

        const { messageDiv, contentDiv } = this.buildMessageElement('system', new Date());
        contentDiv.innerHTML = `<p>${escapeHtml(text)}</p>`;
        this.messagesContainer?.appendChild(messageDiv);
        this.scrollToBottom({ behavior: 'smooth' });
    }

    buildMessageElement(role, timestamp = new Date()) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const header = document.createElement('div');
        header.className = 'message-header';

        const title = document.createElement('strong');
        if (role === 'user') {
            title.textContent = '👤 Você';
        } else if (role === 'assistant') {
            title.textContent = '🤖 Claude';
        } else {
            title.textContent = 'ℹ️ Sistema';
        }

        const meta = document.createElement('div');
        meta.className = 'message-meta';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'timestamp';
        timeSpan.textContent = this.formatTime(normalizeTimestamp(timestamp));

        meta.appendChild(timeSpan);
        header.appendChild(title);
        header.appendChild(meta);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        messageDiv.appendChild(header);
        messageDiv.appendChild(contentDiv);

        return { messageDiv, contentDiv, header };
    }

    createMessageElement(role, content, timestamp, options = {}) {
        const { messageDiv, contentDiv } = this.buildMessageElement(role, timestamp);
        contentDiv.innerHTML = renderMarkdownSafe(content);
        this.highlightCode(contentDiv);
        this.addCopyButtons(contentDiv);
        this.enhanceCodeBlocks(contentDiv);

        if (role === 'assistant' && options.allowCopy !== false) {
            this.attachCopyButton(messageDiv, content);
        }

        if (options.thinking) {
            const thinkingBlock = document.createElement('div');
            thinkingBlock.className = 'thinking-block';
            thinkingBlock.innerHTML = `💭 <em>${escapeHtml(options.thinking)}</em>`;
            contentDiv.prepend(thinkingBlock);
        }

        return messageDiv;
    }

    attachCopyButton(messageDiv, content) {
        if (!messageDiv) return;
        const header = messageDiv.querySelector('.message-header');
        if (!header) return;

        let button = header.querySelector('.copy-message-btn');
        if (!button) {
            button = document.createElement('button');
            button.className = 'copy-message-btn';
            button.type = 'button';
            button.title = 'Copiar mensagem';
            button.textContent = '📋';
            header.appendChild(button);
        }

        button.copyContentValue = content;
        button.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(button.copyContentValue || '').then(() => {
                const previous = button.textContent;
                button.textContent = '✅';
                setTimeout(() => {
                    button.textContent = previous;
                }, 1500);
            });
        };
    }

    highlightCode(root) {
        if (!root || !window.hljs) return;
        root.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    addCopyButtons(root) {
        if (!root) return;

        root.querySelectorAll('pre').forEach((pre) => {
            if (pre.dataset.copyEnhanced === 'true') return;

            const codeEl = pre.querySelector('code');
            if (!codeEl) return;

            const header = document.createElement('div');
            header.className = 'code-header';

            const button = document.createElement('button');
            button.className = 'copy-code-btn';
            button.type = 'button';
            button.textContent = '📋 Copiar';

            button.addEventListener('click', () => {
                navigator.clipboard.writeText(codeEl.textContent || '');
                button.textContent = '✅ Copiado!';
                button.classList.add('copied');
                setTimeout(() => {
                    button.textContent = '📋 Copiar';
                    button.classList.remove('copied');
                }, 2000);
            });

            header.appendChild(button);
            pre.parentNode?.insertBefore(header, pre);
            pre.dataset.copyEnhanced = 'true';
        });
    }

    enhanceCodeBlocks(root) {
        if (!root) return;

        root.querySelectorAll('pre').forEach((pre) => {
            if (pre.dataset.collapsible === 'true') return;
            const codeEl = pre.querySelector('code');
            if (!codeEl) return;

            const content = codeEl.textContent || '';
            const lines = content.split('\n').filter(Boolean).length;
            const shouldCollapse = lines > 12 || content.length > 800;

            if (!shouldCollapse) return;

            const header = pre.previousElementSibling && pre.previousElementSibling.classList?.contains('code-header')
                ? pre.previousElementSibling
                : null;

            const wrapper = document.createElement('div');
            wrapper.className = 'code-block';

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'code-toggle';
            toggle.textContent = 'Ver código completo';

            const parent = pre.parentNode;
            if (!parent) return;

            parent.insertBefore(wrapper, header || pre);
            if (header) {
                wrapper.appendChild(header);
            }
            wrapper.appendChild(pre);
            wrapper.appendChild(toggle);

            pre.classList.add('collapsible');
            pre.dataset.collapsible = 'true';

            toggle.addEventListener('click', () => {
                const expanded = pre.classList.toggle('expanded');
                wrapper.classList.toggle('expanded', expanded);
                toggle.textContent = expanded ? 'Ocultar código' : 'Ver código completo';
            });
        });
    }

    scrollToBottom({ force = false, behavior = 'smooth' } = {}) {
        if (!this.messagesContainer) return;

        const nearBottom = this.messagesContainer.scrollTop + this.messagesContainer.clientHeight >= this.messagesContainer.scrollHeight - 120;

        if (force || this.shouldAutoScroll || nearBottom) {
            const scrollBehavior = force ? 'auto' : behavior;
            this.messagesContainer.scrollTo({
                top: this.messagesContainer.scrollHeight,
                behavior: scrollBehavior
            });
        }
    }

    updateMessageCount() {
        if (!this.messageCountDisplay) return;
        const label = this.messageCount === 1 ? 'mensagem' : 'mensagens';
        this.messageCountDisplay.textContent = `${this.messageCount} ${label}`;
    }

    clearChat(askConfirm = true) {
        if (askConfirm && !confirm('Limpar todo o histórico do chat?')) {
            return;
        }

        if (this.messagesContainer) {
            if (this.initialMessagesSnapshot) {
                this.messagesContainer.innerHTML = this.initialMessagesSnapshot;
            } else {
                this.messagesContainer.innerHTML = '';
            }
        }

        this.conversationId = null;
        this.localConversationId = null;
        this.currentMessage = null;
        this.currentMessageContent = null;
        this.messageCount = 0;
        this.totalCost = 0;
        this.localHistory = [];
        this.pendingAssistantContent = '';
        this.currentChunkCount = 0;
        this.saveLocalHistory();
        this.updateMessageCount();
    }

    loadLocalHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !Array.isArray(parsed.messages)) return null;
            return parsed;
        } catch (err) {
            console.warn('Falha ao carregar histórico local', err);
            return null;
        }
    }

    saveLocalHistory() {
        try {
            if (!this.localHistory.length) {
                localStorage.removeItem(STORAGE_KEY);
                return;
            }

            const payload = {
                conversationId: this.conversationId || this.localConversationId || null,
                messages: this.localHistory
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (err) {
            console.warn('Não foi possível salvar histórico local', err);
        }
    }

    saveMessage(role, content, extra = {}) {
        const entry = {
            role,
            content,
            timestamp: extra.timestamp || new Date().toISOString()
        };

        if (extra.thinking) {
            entry.thinking = extra.thinking;
        }

        this.localHistory.push(entry);

        if (this.localHistory.length > MAX_HISTORY_ITEMS) {
            this.localHistory.splice(0, this.localHistory.length - MAX_HISTORY_ITEMS);
        }

        this.saveLocalHistory();
    }

    restoreHistory() {
        const saved = this.loadLocalHistory();
        if (!saved || !saved.messages.length) {
            this.updateMessageCount();
            return;
        }

        this.localConversationId = saved.conversationId || null;
        this.conversationId = saved.conversationId || this.conversationId;
        this.localHistory = saved.messages.slice(-MAX_HISTORY_ITEMS);

        if (this.messagesContainer) {
            this.messagesContainer.innerHTML = '';
        }

        this.localHistory.forEach((message) => {
            const node = this.createMessageElement(
                message.role,
                message.content,
                message.timestamp,
                { thinking: message.thinking }
            );
            this.messagesContainer?.appendChild(node);
        });

        this.messageCount = this.localHistory.length;
        this.updateMessageCount();
        this.scrollToBottom({ force: true, behavior: 'auto' });
    }

    startNewChat() {
        // Limpar apenas o estado do chat no localStorage (não todo localStorage)
        localStorage.removeItem('claude_chat_history');

        // Recarregar página
        window.location.href = window.location.href.split('?')[0];
    }

    showTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'flex';
        }
        this.startResponseTimer();
        this.scrollToBottom({ behavior: 'smooth' });
    }

    hideTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'none';
        }
        this.stopResponseTimer();
    }

    startResponseTimer() {
        this.responseStartTime = Date.now();

        if (this.responseTimerInterval) {
            clearInterval(this.responseTimerInterval);
        }

        this.responseTimerInterval = setInterval(() => {
            const elapsed = (Date.now() - this.responseStartTime) / 1000;
            if (this.responseTimer) {
                this.responseTimer.textContent = `${elapsed.toFixed(1)}s`;

                if (elapsed > 10) {
                    this.responseTimer.style.color = '#ef4444';
                } else if (elapsed > 5) {
                    this.responseTimer.style.color = '#f59e0b';
                } else {
                    this.responseTimer.style.color = '#10b981';
                }
            }
        }, 100);
    }

    stopResponseTimer() {
        if (this.responseTimerInterval) {
            clearInterval(this.responseTimerInterval);
            this.responseTimerInterval = null;
        }

        if (this.responseStartTime) {
            const finalTime = Date.now() - this.responseStartTime;
            window.debugSystem?.log('info', 'Performance', `Tempo de resposta: ${finalTime}ms`);
        }

        this.responseStartTime = null;
        if (this.responseTimer) {
            this.responseTimer.style.color = '';
        }
    }

    handleToolEvent(data) {
        const name = data.tool || data.tool_name || 'Ferramenta';
        const id = data.tool_use_id || name;

        if (data.type === 'tool_start') {
            const actionPreview = truncateText(safeStringify(data.input || data.action || 'Executando...'), 120);
            window.toolIndicator?.addTool(name, actionPreview, id);
            this.showToolActivity(id, name, actionPreview);
            window.debugVisual?.log('info', `🛠️ Iniciando ${name}`);
            return;
        }

        const status = data.is_error ? 'error' : 'success';
        const action = data.is_error ? 'Falhou' : 'Concluído';
        window.toolIndicator?.updateTool(id, {
            status: data.is_error ? 'error' : 'done',
            action
        });
        setTimeout(() => window.toolIndicator?.removeTool(id), data.is_error ? 2500 : 1500);

        this.updateToolActivity(id, status, {
            name,
            detail: data.error || data.content || action
        });

        if (data.is_error) {
            this.showSystemMessage(`Ferramenta ${name} falhou: ${truncateText(data.error || data.content || '')}`);
        }
    }

    showToolActivity(id, name, description) {
        const messageEl = this.ensureAssistantMessage();
        const contentDiv = this.currentMessageContent || messageEl.querySelector('.message-content');
        if (!contentDiv) return;

        let list = contentDiv.querySelector('.tool-activity-list');
        if (!list) {
            list = document.createElement('div');
            list.className = 'tool-activity-list';
            contentDiv.prepend(list);
        }

        const item = document.createElement('div');
        item.className = 'tool-activity running';
        item.dataset.toolId = id;
        item.innerHTML = `
            <span class="tool-activity-icon">🔧</span>
            <span class="tool-activity-text"><strong>${escapeHtml(name)}</strong> — ${escapeHtml(description)}</span>
        `;

        list.appendChild(item);
        this.toolActivities.set(id, item);
        this.scrollToBottom({ behavior: 'smooth' });
    }

    updateToolActivity(id, status, data) {
        const item = this.toolActivities.get(id);
        if (!item) return;

        item.classList.remove('running', 'success', 'error');
        item.classList.add(status === 'error' ? 'error' : 'success');

        const icon = item.querySelector('.tool-activity-icon');
        if (icon) {
            icon.textContent = status === 'error' ? '⚠️' : '✅';
        }

        const text = item.querySelector('.tool-activity-text');
        if (text) {
            const detail = truncateText(safeStringify(data.detail || ''), 160);
            text.innerHTML = `<strong>${escapeHtml(data.name || 'Ferramenta')}</strong> — ${escapeHtml(detail || (status === 'error' ? 'Erro' : 'Finalizado'))}`;
        }

        setTimeout(() => {
            item.remove();
            this.toolActivities.delete(id);
        }, status === 'error' ? 6000 : 3000);
    }

    formatTime(date) {
        return normalizeTimestamp(date).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando Claude Chat App...');
    window.chatApp = new ClaudeChatApp();
});

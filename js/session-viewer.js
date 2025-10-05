const SESSION_ID = '35fff2dc-b4d2-4d4b-8893-c328d0302095';

class SessionViewer {
    constructor() {
        this.ws = null;
        this.sessionId = SESSION_ID;
        this.conversationId = null;
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
        this.messagesContainer = document.getElementById('messages');
        this.init();
    }

    init() {
        this.connectWebSocket();
        this.sendButton.onclick = () => this.sendMessage();
        this.messageInput.onkeypress = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        };
    }

    connectWebSocket() {
        this.ws = new WebSocket('ws://localhost:8080/ws/chat');
        this.ws.onopen = () => {
            console.log('Conectado');
            window.debugVisual?.log('websocket', 'Conectado ao backend');
        };
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        this.addUserMessage(message);
        this.ws.send(JSON.stringify({
            message: message,
            session_id: this.sessionId
        }));

        this.messageInput.value = '';
        this.sendButton.disabled = true;
    }

    handleServerMessage(data) {
        if (data.type === 'text_chunk') {
            this.appendToCurrentMessage(data.content);
        } else if (data.type === 'result') {
            this.sendButton.disabled = false;
        }
    }

    addUserMessage(content) {
        const div = document.createElement('div');
        div.className = 'message user';
        const time = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
        div.innerHTML = '<div class="message-header"><strong>👤 Você</strong><span class="timestamp">' + time + '</span></div><div class="message-content"><p>' + content + '</p></div>';
        this.messagesContainer.appendChild(div);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    appendToCurrentMessage(text) {
        let p = this.messagesContainer.querySelector('.message.assistant:last-child .message-content p:last-child');
        if (!p) {
            const div = document.createElement('div');
            div.className = 'message assistant';
            const time = new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
            div.innerHTML = '<div class="message-header"><strong>🤖 Claude</strong><span class="timestamp">' + time + '</span></div><div class="message-content"><p></p></div>';
            this.messagesContainer.appendChild(div);
            p = div.querySelector('p');
        }
        p.textContent += text;
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
}

window.addEventListener('load', () => { new SessionViewer(); });

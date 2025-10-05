class NotificationSystem {
    constructor() {
        this.supported = 'Notification' in window;
        this.permission = this.supported ? Notification.permission : 'denied';
        this.lastContent = '';

        if (this.supported) {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.clearBadge();
                }
            });
        }
    }

    async ensurePermission() {
        if (!this.supported) return false;

        if (this.permission === 'granted') {
            return true;
        }

        if (this.permission === 'denied') {
            return false;
        }

        try {
            const result = await Notification.requestPermission();
            this.permission = result;
            return result === 'granted';
        } catch (err) {
            console.warn('Notification permission error:', err);
            return false;
        }
    }

    async notifyResponse(content) {
        if (!this.supported) {
            return;
        }

        const hasPermission = await this.ensurePermission();
        if (!hasPermission) {
            return;
        }

        const body = this.truncate(content, 180);
        this.lastContent = body;

        const notification = new Notification('Claude respondeu', {
            body,
            icon: '/favicon.ico',
            tag: 'claude-chat-response',
            requireInteraction: false
        });

        notification.addEventListener('click', () => {
            window.focus();
            notification.close();
            this.clearBadge();
        });

        this.setBadge();

        setTimeout(() => notification.close(), 6000);
    }

    truncate(text, maxLength) {
        if (!text) return '';
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (normalized.length <= maxLength) {
            return normalized;
        }
        return normalized.slice(0, maxLength - 1) + '…';
    }

    setBadge() {
        if ('setAppBadge' in navigator) {
            navigator.setAppBadge().catch(() => {});
        } else {
            document.title = '● ' + document.title.replace(/^●\s+/, '');
        }
    }

    clearBadge() {
        if ('clearAppBadge' in navigator) {
            navigator.clearAppBadge().catch(() => {});
        } else {
            document.title = document.title.replace(/^●\s+/, '');
        }
    }
}

window.notificationSystem = new NotificationSystem();

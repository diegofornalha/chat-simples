/**
 * Search System - Busca em conversas
 */

class SearchSystem {
    constructor(chatApp) {
        this.app = chatApp;
        this.searchInput = document.getElementById('search-input');
        this.currentResults = [];
        this.currentIndex = -1;

        this.init();
    }

    init() {
        // Debounce search
        let searchTimeout;
        this.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.search(e.target.value);
            }, 300);
        });

        // Enter para próximo resultado
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.nextResult();
            } else if (e.key === 'Escape') {
                this.clear();
            }
        });
    }

    search(query) {
        // Limpar highlights anteriores
        this.clearHighlights();

        if (!query || query.length < 2) {
            this.currentResults = [];
            this.currentIndex = -1;
            return;
        }

        const messages = document.querySelectorAll('.message');
        this.currentResults = [];

        messages.forEach((msgDiv, msgIndex) => {
            const content = msgDiv.querySelector('.message-content');
            if (!content) return;

            const text = content.textContent.toLowerCase();
            const queryLower = query.toLowerCase();

            if (text.includes(queryLower)) {
                this.currentResults.push({
                    element: msgDiv,
                    contentElement: content
                });

                // Highlight
                this.highlightMatches(content, query);
            }
        });

        if (this.currentResults.length > 0) {
            this.currentIndex = 0;
            this.scrollToResult(0);

            // Mostrar contador
            this.showResultCount();
        } else {
            this.showNoResults();
        }

        window.debugSystem?.log('info', 'Search', `Busca por "${query}": ${this.currentResults.length} resultados`);
    }

    highlightMatches(contentElement, query) {
        const walker = document.createTreeWalker(
            contentElement,
            NodeFilter.SHOW_TEXT,
            null
        );

        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(node => {
            const text = node.nodeValue;
            if (!text) return;

            const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
            const matches = text.match(regex);

            if (matches) {
                const span = document.createElement('span');
                span.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
                node.parentNode.replaceChild(span, node);
            }
        });
    }

    clearHighlights() {
        document.querySelectorAll('.search-highlight').forEach(mark => {
            const text = mark.textContent;
            mark.replaceWith(text);
        });

        document.querySelectorAll('.search-result-active').forEach(el => {
            el.classList.remove('search-result-active');
        });
    }

    scrollToResult(index) {
        if (index < 0 || index >= this.currentResults.length) return;

        const result = this.currentResults[index];

        // Remover active anterior
        document.querySelectorAll('.search-result-active').forEach(el => {
            el.classList.remove('search-result-active');
        });

        // Marcar como active
        result.element.classList.add('search-result-active');

        // Scroll suave
        result.element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        this.currentIndex = index;
        this.showResultCount();
    }

    nextResult() {
        if (this.currentResults.length === 0) return;

        const nextIndex = (this.currentIndex + 1) % this.currentResults.length;
        this.scrollToResult(nextIndex);
    }

    prevResult() {
        if (this.currentResults.length === 0) return;

        const prevIndex = (this.currentIndex - 1 + this.currentResults.length) % this.currentResults.length;
        this.scrollToResult(prevIndex);
    }

    showResultCount() {
        const count = this.currentResults.length;
        const current = this.currentIndex + 1;

        this.searchInput.title = `Resultado ${current}/${count}`;
        this.searchInput.style.borderColor = '#10b981';
    }

    showNoResults() {
        this.searchInput.title = 'Nenhum resultado encontrado';
        this.searchInput.style.borderColor = '#ef4444';
    }

    clear() {
        this.searchInput.value = '';
        this.searchInput.style.borderColor = '';
        this.searchInput.title = '';
        this.clearHighlights();
        this.currentResults = [];
        this.currentIndex = -1;
    }

    escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// CSS para search
const searchStyles = `
    .search-input {
        background: var(--bg-dark);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 0.5rem 1rem;
        color: var(--text-primary);
        font-size: 0.9rem;
        width: 250px;
        transition: all 0.2s;
    }

    .search-input:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
    }

    .search-highlight {
        background: #f59e0b;
        color: #000;
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: 600;
    }

    .search-result-active {
        outline: 3px solid #10b981;
        outline-offset: 4px;
    }

    .header-actions {
        display: flex;
        gap: 1rem;
        align-items: center;
    }
`;

const searchStyleElement = document.createElement('style');
searchStyleElement.textContent = searchStyles;
document.head.appendChild(searchStyleElement);

// Inicializar
window.addEventListener('load', () => {
    if (window.chatApp) {
        window.searchSystem = new SearchSystem(window.chatApp);
        console.log('🔍 Search System ativado');
    }
});

/**
 * Performance Metrics - Monitoramento em tempo real
 */

class PerformanceMetrics {
    constructor(showPanel = false) {
        this.metrics = {
            messagesCount: 0,
            avgResponseTime: 0,
            responseTimes: [],
            totalCost: 0,
            chunksReceived: 0,
            errorsCount: 0,
            startTime: Date.now(),
            lastMessageTime: null,
        };

        this.showPanel = showPanel;

        if (this.showPanel) {
            this.createMetricsPanel();
        }
    }

    createMetricsPanel() {
        const panel = document.createElement('div');
        panel.id = 'metrics-panel';
        panel.className = 'metrics-panel collapsed';
        panel.innerHTML = `
            <button class="metrics-toggle" id="metrics-toggle">
                📊 Métricas
            </button>
            <div class="metrics-content">
                <div class="metrics-header">
                    <h3>📊 Performance Metrics</h3>
                </div>
                <div class="metrics-grid" id="metrics-grid"></div>
                <div class="metrics-chart" id="metrics-chart">
                    <canvas id="response-time-chart" width="300" height="150"></canvas>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Toggle
        document.getElementById('metrics-toggle').onclick = () => {
            panel.classList.toggle('collapsed');
        };

        // Update a cada segundo
        setInterval(() => this.update(), 1000);
    }

    recordMessage(responseTime, cost, chunks, isError = false) {
        this.metrics.messagesCount++;
        this.metrics.totalCost += cost || 0;
        this.metrics.chunksReceived += chunks || 0;
        this.metrics.lastMessageTime = Date.now();

        if (isError) {
            this.metrics.errorsCount++;
        }

        if (responseTime) {
            this.metrics.responseTimes.push(responseTime);
            // Manter apenas últimos 20
            if (this.metrics.responseTimes.length > 20) {
                this.metrics.responseTimes.shift();
            }

            // Calcular média
            this.metrics.avgResponseTime =
                this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length;
        }

        this.update();
        window.debugSystem?.updateMetrics(this.metrics);
    }

    update() {
        const grid = document.getElementById('metrics-grid');
        if (!grid) return;

        const uptime = Math.floor((Date.now() - this.metrics.startTime) / 1000);
        const uptimeStr = this.formatUptime(uptime);

        const successRate = this.metrics.messagesCount > 0
            ? ((this.metrics.messagesCount - this.metrics.errorsCount) / this.metrics.messagesCount * 100).toFixed(1)
            : 100;

        grid.innerHTML = `
            <div class="metric-card">
                <div class="metric-icon">💬</div>
                <div class="metric-data">
                    <div class="metric-value">${this.metrics.messagesCount}</div>
                    <div class="metric-label">Mensagens</div>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-icon">⚡</div>
                <div class="metric-data">
                    <div class="metric-value">${this.metrics.avgResponseTime.toFixed(0)}ms</div>
                    <div class="metric-label">Tempo Médio</div>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-icon">💰</div>
                <div class="metric-data">
                    <div class="metric-value">$${this.metrics.totalCost.toFixed(4)}</div>
                    <div class="metric-label">Custo Total</div>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-icon">📦</div>
                <div class="metric-data">
                    <div class="metric-value">${this.metrics.chunksReceived}</div>
                    <div class="metric-label">Chunks</div>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-icon">✅</div>
                <div class="metric-data">
                    <div class="metric-value">${successRate}%</div>
                    <div class="metric-label">Taxa Sucesso</div>
                </div>
            </div>

            <div class="metric-card">
                <div class="metric-icon">⏱️</div>
                <div class="metric-data">
                    <div class="metric-value">${uptimeStr}</div>
                    <div class="metric-label">Uptime</div>
                </div>
            </div>
        `;

        // Atualizar gráfico
        this.updateChart();
    }

    updateChart() {
        const canvas = document.getElementById('response-time-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Limpar
        ctx.clearRect(0, 0, width, height);

        if (this.metrics.responseTimes.length === 0) return;

        // Desenhar gráfico de linha
        const times = this.metrics.responseTimes;
        const maxTime = Math.max(...times, 1);
        const step = width / (times.length || 1);

        ctx.beginPath();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;

        times.forEach((time, i) => {
            const x = i * step;
            const y = height - (time / maxTime) * height;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Desenhar pontos
        ctx.fillStyle = '#6366f1';
        times.forEach((time, i) => {
            const x = i * step;
            const y = height - (time / maxTime) * height;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Labels
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px monospace';
        ctx.fillText(`Max: ${maxTime.toFixed(0)}ms`, 5, 15);
        ctx.fillText(`Avg: ${this.metrics.avgResponseTime.toFixed(0)}ms`, 5, 30);
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}

// CSS para metrics panel
const metricsStyles = `
    .metrics-panel {
        position: fixed;
        top: 100px;
        right: 20px;
        width: 350px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.3);
        z-index: 1000;
        transition: transform 0.3s;
    }

    .metrics-panel.collapsed {
        transform: translateX(calc(100% - 100px));
    }

    .metrics-toggle {
        position: absolute;
        left: -40px;
        top: 50%;
        transform: translateY(-50%) rotate(-90deg);
        background: var(--primary);
        border: none;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 8px 8px 0 0;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
    }

    .metrics-content {
        padding: 1rem;
    }

    .metrics-header h3 {
        margin: 0 0 1rem 0;
        font-size: 1.1rem;
        color: var(--text-primary);
    }

    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .metric-card {
        background: var(--bg-hover);
        padding: 0.75rem;
        border-radius: 8px;
        border: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .metric-icon {
        font-size: 1.5rem;
    }

    .metric-data {
        flex: 1;
    }

    .metric-value {
        font-size: 1.2rem;
        font-weight: bold;
        color: var(--primary);
        line-height: 1;
        margin-bottom: 0.25rem;
    }

    .metric-label {
        font-size: 0.7rem;
        color: var(--text-secondary);
        text-transform: uppercase;
    }

    .metrics-chart {
        background: var(--bg-dark);
        border-radius: 8px;
        padding: 1rem;
        border: 1px solid var(--border);
    }

    #response-time-chart {
        width: 100%;
        height: auto;
    }
`;

const metricsStyleElement = document.createElement('style');
metricsStyleElement.textContent = metricsStyles;
document.head.appendChild(metricsStyleElement);

// Inicializar
window.addEventListener('load', () => {
    window.performanceMetrics = new PerformanceMetrics();
    console.log('📊 Performance Metrics ativado');
});

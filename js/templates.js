/**
 * Templates de Prompts para Uso Rápido
 */

const PROMPT_TEMPLATES = [
    {
        category: "Código",
        icon: "💻",
        templates: [
            {
                name: "Criar API REST",
                prompt: "Crie uma API REST completa com FastAPI incluindo:\n- CRUD de usuários\n- Autenticação JWT\n- Validação com Pydantic\n- Documentação automática\n- Testes unitários"
            },
            {
                name: "Algoritmo",
                prompt: "Escreva um algoritmo eficiente em Python para [DESCREVA O PROBLEMA]. Inclua:\n- Análise de complexidade\n- Casos de teste\n- Otimizações possíveis"
            },
            {
                name: "Refatorar Código",
                prompt: "Refatore este código seguindo clean code:\n\n```python\n# Cole seu código aqui\n```\n\nSugestões de melhoria:"
            },
            {
                name: "Debug Código",
                prompt: "Analise este código e identifique bugs:\n\n```python\n# Cole código com bug aqui\n```\n\nO que está errado?"
            }
        ]
    },
    {
        category: "Documentação",
        icon: "📚",
        templates: [
            {
                name: "README Completo",
                prompt: "Crie um README.md profissional para este projeto:\n\nNome: [NOME]\nDescrição: [DESCRIÇÃO]\nStack: [TECNOLOGIAS]\n\nInclua: instalação, uso, exemplos, contribuição"
            },
            {
                name: "Docstrings",
                prompt: "Adicione docstrings detalhadas neste código:\n\n```python\n# Cole código aqui\n```\n\nUse formato Google/NumPy style"
            },
            {
                name: "Tutorial Step-by-Step",
                prompt: "Crie tutorial passo-a-passo para: [TECNOLOGIA/CONCEITO]\n\nPúblico: iniciantes\nFormato: markdown com exemplos práticos"
            }
        ]
    },
    {
        category: "Análise",
        icon: "🔍",
        templates: [
            {
                name: "Code Review",
                prompt: "Faça code review detalhado deste código:\n\n```python\n# Cole código aqui\n```\n\nAvalie: performance, segurança, manutenibilidade, best practices"
            },
            {
                name: "Comparação",
                prompt: "Compare [TECNOLOGIA A] vs [TECNOLOGIA B] para:\n\nCaso de uso: [DESCREVA]\n\nCritérios: performance, facilidade, comunidade, custo"
            },
            {
                name: "Arquitetura",
                prompt: "Analise a arquitetura deste sistema e sugira melhorias:\n\n[DESCREVA O SISTEMA]\n\nFoque em: escalabilidade, manutenibilidade, performance"
            }
        ]
    },
    {
        category: "Aprendizado",
        icon: "🎓",
        templates: [
            {
                name: "Explicar Conceito",
                prompt: "Explique [CONCEITO/TECNOLOGIA] de forma:\n\n1. Simples (ELI5)\n2. Intermediária (com exemplos)\n3. Avançada (detalhes técnicos)\n\nInclua código quando relevante"
            },
            {
                name: "Exercício Prático",
                prompt: "Crie um exercício prático para aprender [CONCEITO]:\n\n- Nível: [iniciante/intermediário/avançado]\n- Inclua: enunciado, solução, explicação"
            },
            {
                name: "Roadmap",
                prompt: "Crie roadmap de estudos para: [TECNOLOGIA/ÁREA]\n\nObjetivo: [OBJETIVO]\nTempo disponível: [TEMPO]\n\nDivida em fases com recursos recomendados"
            }
        ]
    },
    {
        category: "Produtividade",
        icon: "⚡",
        templates: [
            {
                name: "Script Automação",
                prompt: "Crie script Python para automatizar:\n\n[DESCREVA TAREFA REPETITIVA]\n\nRequisitos: robusto, com logs, error handling"
            },
            {
                name: "CI/CD Pipeline",
                prompt: "Configure CI/CD para este projeto:\n\nStack: [TECNOLOGIAS]\nDeploy: [ONDE]\n\nUse GitHub Actions / GitLab CI"
            },
            {
                name: "Docker Setup",
                prompt: "Crie setup Docker completo para:\n\nApp: [DESCRIÇÃO]\nServiços: [BANCO, CACHE, etc]\n\nInclua: Dockerfile, docker-compose, .dockerignore"
            }
        ]
    }
];

// Função para mostrar templates
function showTemplates() {
    const modal = document.createElement('div');
    modal.id = 'templates-modal';
    modal.className = 'modal';

    let templatesHTML = '';

    PROMPT_TEMPLATES.forEach(category => {
        templatesHTML += `
            <div class="template-category">
                <h3>${category.icon} ${category.category}</h3>
                <div class="template-list">
                    ${category.templates.map(t => `
                        <button class="template-item" data-prompt="${escapeHtml(t.prompt)}">
                            <strong>${t.name}</strong>
                            <small>${t.prompt.substring(0, 60)}...</small>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    });

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>📝 Templates de Prompts</h2>
                <button class="modal-close">✕</button>
            </div>
            <div class="modal-body">
                ${templatesHTML}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    modal.querySelectorAll('.template-item').forEach(item => {
        item.onclick = () => {
            const prompt = item.dataset.prompt;
            document.getElementById('message-input').value = prompt;
            document.getElementById('message-input').focus();
            modal.remove();
        };
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Templates ativado apenas via Ctrl+K (não mostra botão)
// Para ativar visualmente: showTemplates()
console.log('📝 Templates carregados (use Ctrl+K para abrir)');

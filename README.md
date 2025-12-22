# Chat Simples

Backend mínimo para expor o Claude Agent SDK via HTTP.

## Requisitos

- Python 3.10+
- CLI `claude` instalado e logado (`claude login`)

## Instalação

```bash
pip install -r requirements.txt
```

## Executar

```bash
# Opção 1: direto
python server.py

# Opção 2: com reload (dev)
uvicorn server:app --reload --port 8000
```

## Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Health check |
| POST | `/chat` | Chat simples (resposta completa) |
| POST | `/chat/stream` | Chat com streaming (SSE) |

## Exemplos

### Chat simples

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá! Diga oi."}'
```

### Chat com streaming

```bash
curl -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Conte uma história curta."}'
```

## Estrutura

```
chat-simples/
├── server.py        # Servidor FastAPI
├── requirements.txt # Dependências
└── README.md        # Este arquivo
```

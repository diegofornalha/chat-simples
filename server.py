# =============================================================================
# CHAT SIMPLES - Backend mínimo para o Hello Agent
# =============================================================================
#
# Um servidor FastAPI simples que expõe o Claude Agent SDK via HTTP.
# Sem API key - usa o CLI 'claude' que já está logado.
#
# Para rodar:
#   uvicorn server:app --reload --port 8000
#
# =============================================================================

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncio

# SDK do Claude Agent (usa CLI por baixo)
from claude_agent_sdk import query, AssistantMessage, TextBlock

# =============================================================================
# APP FASTAPI
# =============================================================================

app = FastAPI(
    title="Chat Simples",
    description="Backend mínimo para Claude Agent SDK",
    version="1.0.0"
)

# CORS - permite requisições do frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, especifique os domínios
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# MODELOS
# =============================================================================

class ChatRequest(BaseModel):
    """Requisição de chat."""
    message: str

class ChatResponse(BaseModel):
    """Resposta de chat."""
    response: str

# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    """Health check."""
    return {"status": "ok", "message": "Chat Simples rodando!"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Endpoint simples de chat.
    Envia mensagem e retorna resposta completa.
    """
    response_text = ""

    async for message in query(prompt=request.message):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    response_text += block.text

    return ChatResponse(response=response_text)


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Endpoint de chat com streaming.
    Retorna resposta em tempo real.
    """
    async def generate():
        async for message in query(prompt=request.message):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        yield f"data: {block.text}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando Chat Simples na porta 8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)

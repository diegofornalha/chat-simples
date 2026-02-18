# =============================================================================
# CHAT SIMPLES - Backend mínimo para o Hello Agent
# =============================================================================
#
# Um servidor FastAPI que expõe o Claude Agent SDK via HTTP
# e permite visualizar sessões JSONL do OpenClaw.
#
# Para rodar:
#   uvicorn server:app --reload --port 8000
#
# =============================================================================

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import json
import os
from pathlib import Path

# SDK do Claude Agent (usa CLI por baixo)
try:
    from claude_agent_sdk import query, AssistantMessage, TextBlock
    HAS_SDK = True
except ImportError:
    HAS_SDK = False

# =============================================================================
# CONFIG
# =============================================================================

SESSIONS_DIR = Path(os.environ.get(
    "SESSIONS_DIR",
    "/home/agents/.openclaw/agents/audio/sessions"
))

AUDIO_DIRS = [
    Path("/tmp/audio-studio"),
    Path("/home/agents/.openclaw/media"),
]

# =============================================================================
# APP FASTAPI
# =============================================================================

app = FastAPI(
    title="Chat Simples",
    description="Backend mínimo para Claude Agent SDK + Session Viewer",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# MODELOS
# =============================================================================

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

# =============================================================================
# HELPERS - Parse JSONL
# =============================================================================

def parse_session_jsonl(filepath: Path) -> dict:
    """Lê um arquivo .jsonl de sessão e extrai mensagens conversacionais."""
    entries = []
    session_info = {}

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            if entry.get("type") == "session":
                session_info = {
                    "id": entry.get("id", ""),
                    "cwd": entry.get("cwd", ""),
                    "timestamp": entry.get("timestamp", ""),
                    "version": entry.get("version"),
                }
                continue

            entries.append(entry)

    # Extrair mensagens user/assistant legíveis + referências de áudio
    messages = []
    # Coletar áudios enviados via tool "message"
    audio_files_sent = []  # [(timestamp, filepath)]

    for entry in entries:
        if entry.get("type") != "message":
            continue

        msg = entry.get("message", {})
        role = msg.get("role")

        # Capturar áudios de toolResult do tool "message"
        if role == "toolResult" and msg.get("toolName") == "message":
            details = msg.get("details", {})
            media_url = details.get("mediaUrl", "")
            if media_url and any(media_url.endswith(ext) for ext in (".mp3", ".wav", ".ogg", ".m4a")):
                audio_files_sent.append({
                    "timestamp": entry.get("timestamp", ""),
                    "filepath": media_url,
                    "filename": Path(media_url).name,
                    "target": details.get("to", ""),
                })
            continue

        if role not in ("user", "assistant"):
            continue

        content_blocks = msg.get("content", [])
        if isinstance(content_blocks, str):
            text = content_blocks.strip()
            thinking = None
            tool_calls = []
        elif isinstance(content_blocks, list):
            text_parts = []
            tool_calls = []
            thinking = None
            for block in content_blocks:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "text":
                    t = block.get("text", "").strip()
                    if t and t != "NO_REPLY":
                        text_parts.append(t)
                elif block.get("type") == "thinking":
                    thinking = block.get("thinking", "")
                elif block.get("type") == "toolCall":
                    tool_name = block.get("name", "")
                    tool_args = block.get("arguments", {})
                    tool_calls.append({
                        "name": tool_name,
                        "arguments": tool_args,
                    })
            text = "\n".join(text_parts)
            if not text and not tool_calls:
                continue
        else:
            continue

        if not text and role == "assistant":
            continue

        message_data = {
            "role": role,
            "text": text,
            "timestamp": entry.get("timestamp", msg.get("timestamp", "")),
        }

        # Adicionar metadados extras para assistant
        if role == "assistant":
            model = msg.get("model", "")
            provider = msg.get("provider", "")
            usage = msg.get("usage", {})
            cost = usage.get("cost", {}).get("total", 0)
            if model:
                message_data["model"] = model
            if provider:
                message_data["provider"] = provider
            if cost:
                message_data["cost"] = cost
            if thinking:
                message_data["thinking"] = thinking
            if tool_calls:
                message_data["tool_calls"] = tool_calls

            # Detectar se o texto é um nome de arquivo de áudio
            if text and any(text.strip().endswith(ext) for ext in (".mp3", ".wav", ".ogg")):
                message_data["audio_filename"] = text.strip()

        messages.append(message_data)

    # Enriquecer mensagens com áudios enviados (associar por proximidade temporal)
    for audio_info in audio_files_sent:
        audio_ts = audio_info["timestamp"]
        # Encontrar a mensagem assistant mais próxima antes desse timestamp
        best_msg = None
        for m in messages:
            if m["role"] != "assistant":
                continue
            if m["timestamp"] <= audio_ts:
                best_msg = m
        if best_msg and "audio_file" not in best_msg:
            best_msg["audio_file"] = audio_info["filename"]
            best_msg["audio_path"] = audio_info["filepath"]

    return {
        "session": session_info,
        "messages": messages,
        "total_entries": len(entries),
    }


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    return FileResponse(
        Path(__file__).parent / "index.html",
        media_type="text/html"
    )


@app.get("/sessions")
async def list_sessions():
    """Lista todas as sessões JSONL disponíveis."""
    if not SESSIONS_DIR.exists():
        return {"sessions": [], "error": f"Diretório não encontrado: {SESSIONS_DIR}"}

    sessions = []
    for f in sorted(SESSIONS_DIR.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            # Ler apenas a primeira linha para pegar info da sessão
            with open(f, "r", encoding="utf-8") as fh:
                first_line = fh.readline().strip()
                if first_line:
                    header = json.loads(first_line)
                else:
                    header = {}

            stat = f.stat()
            sessions.append({
                "id": header.get("id", f.stem),
                "filename": f.name,
                "timestamp": header.get("timestamp", ""),
                "size_kb": round(stat.st_size / 1024, 1),
            })
        except Exception:
            continue

    return {"sessions": sessions}


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Carrega e parseia uma sessão JSONL."""
    filepath = SESSIONS_DIR / f"{session_id}.jsonl"

    if not filepath.exists():
        # Tentar buscar por nome parcial
        matches = list(SESSIONS_DIR.glob(f"{session_id}*.jsonl"))
        if matches:
            filepath = matches[0]
        else:
            raise HTTPException(status_code=404, detail=f"Sessão não encontrada: {session_id}")

    try:
        result = parse_session_jsonl(filepath)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/audio/{filename:path}")
async def serve_audio(filename: str):
    """Serve arquivos de áudio (.mp3, .wav) dos diretórios conhecidos."""
    # Sanitizar: só o nome do arquivo, sem path traversal
    safe_name = Path(filename).name
    if not safe_name or ".." in filename:
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido")

    for audio_dir in AUDIO_DIRS:
        filepath = audio_dir / safe_name
        if filepath.exists() and filepath.is_file():
            suffix = filepath.suffix.lower()
            media_types = {
                ".mp3": "audio/mpeg",
                ".wav": "audio/wav",
                ".ogg": "audio/ogg",
                ".m4a": "audio/mp4",
            }
            media_type = media_types.get(suffix, "application/octet-stream")
            return FileResponse(filepath, media_type=media_type)

    # Tentar path absoluto se existir
    abs_path = Path(filename)
    if abs_path.exists() and abs_path.is_file():
        suffix = abs_path.suffix.lower()
        media_types = {".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4"}
        return FileResponse(abs_path, media_type=media_types.get(suffix, "application/octet-stream"))

    raise HTTPException(status_code=404, detail=f"Áudio não encontrado: {safe_name}")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Endpoint simples de chat."""
    if not HAS_SDK:
        return ChatResponse(response="[SDK não disponível] " + request.message)

    response_text = ""
    async for message in query(prompt=request.message):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    response_text += block.text

    return ChatResponse(response=response_text)


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Endpoint de chat com streaming."""
    if not HAS_SDK:
        async def fallback():
            yield f"data: [SDK não disponível]\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(fallback(), media_type="text/event-stream")

    async def generate():
        async for message in query(prompt=request.message):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        yield f"data: {block.text}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# Servir arquivos estáticos (CSS, JS)
app.mount("/css", StaticFiles(directory=Path(__file__).parent / "css"), name="css")
app.mount("/js", StaticFiles(directory=Path(__file__).parent / "js"), name="js")


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    print("Iniciando Chat Simples na porta 8000...")
    print(f"Sessions dir: {SESSIONS_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=8000)

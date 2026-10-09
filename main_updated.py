from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from langgraph.types import Command

from agents.node import graph

app = FastAPI()

# Lets the HTML page (opened from a file or another port) call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


from pathlib import Path
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).resolve().parent

@app.get("/", include_in_schema=False)
async def serve_frontend():
    index_file = BASE_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="index.html not found beside the server file")
    return FileResponse(index_file, media_type="text/html")


@app.get("/style.css", include_in_schema=False)
async def serve_stylesheet():
    css_file = BASE_DIR / "style.css"
    if not css_file.exists():
        raise HTTPException(status_code=404, detail="style.css not found beside the server file")
    return FileResponse(css_file, media_type="text/css")


@app.get("/script.js", include_in_schema=False)
async def serve_javascript():
    js_file = BASE_DIR / "script.js"
    if not js_file.exists():
        raise HTTPException(status_code=404, detail="script.js not found beside the server file")
    return FileResponse(js_file, media_type="application/javascript")


class ChatRequest(BaseModel):
    message: str    
    thread_id: str


class ApproveRequest(BaseModel):
    thread_id: str
    approved: bool


def format_result(result: dict) -> dict:
    """Turn a graph result into JSON the UI understands."""
    interrupts = result.get("__interrupt__")
    if interrupts:
        return {"status": "approval_required", "approval": interrupts[0].value}

    content = result["messages"][-1].content
    if isinstance(content, list):  # some models return content blocks
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return {"status": "done", "reply": content}


@app.post("/chat")
async def chat(req: ChatRequest):
    config = {"configurable": {"thread_id": req.thread_id}}
    try:
        result = await graph.ainvoke(
            {"messages": [HumanMessage(content=req.message)]},
            config=config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return format_result(result)


@app.post("/approve")
async def approve(req: ApproveRequest):
    config = {"configurable": {"thread_id": req.thread_id}}
    try:
        result = await graph.ainvoke(
            Command(resume={"approved": req.approved}),
            config=config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return format_result(result)

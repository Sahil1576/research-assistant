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

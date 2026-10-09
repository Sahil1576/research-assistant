from langgraph.graph import StateGraph, add_messages
from typing import Annotated
from pydantic import BaseModel, Field

class State(BaseModel):
    messages:Annotated[list,add_messages]
    approval:bool = Field(default=True)

graph_builder = StateGraph(State)
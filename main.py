from agents.state import State
from agents.node import graph
from fastapi import FastAPI
from uuid import UUID
from langgraph.types import Command

app = FastAPI()

@app.post("/")
def dashboard(name:str):
    return f"Hi, Welcome {name}."

@app.post("/chat")
async def chat(state:State):

    config = {
        "configurable":{
            "thread_id":UUID
        }
    }

    response = await graph.ainvoke(state,config=config)

    if "__interrupt__" in response:

        data = response.__interrupt__[0].value

        print(f"TO:{data['to']}")
        print(f"SUBJECT:{data['subject']}")
        print(f"BODY:{data['body']}")

        choice = input(f"{data['message']} (yes/no) -> ")

        choice = choice.lower().strip()

        response = await graph.ainvoke(
            Command(resume={
                "approved":choice
            }),
            config=config
        )

        return response['messages'][-1].content

    return response['messages'][-1].content
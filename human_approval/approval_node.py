from agents.state import State
from langgraph.types import interrupt


def approval_node(state:State):

    last_message = state.messages[-1]

    email_call = [
        call for call in last_message.tool_calls 
        if call["name"] == "send_email"
        ]

    if not email_call:
        raise ValueError("Email tool call not found.")

    email_call = email_call[0]

    decision = interrupt({
        "type":"email approval",
        "to":email_call["args"].get("to"),
        "subject":email_call["args"].get("subject"),
        "body":email_call["args"].get("body"),
        "message":"Do you approve for send an email?"
    })

    return {
        "approval":True
    }
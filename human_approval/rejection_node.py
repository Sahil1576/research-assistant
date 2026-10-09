from langchain_core.messages import ToolMessage
from agents.node import State

def rejection_node(state:State):

    last_message = state.messages[-1]

    email_call = [
        call for call in last_message.tool_calls 
        if call["name"] == "send_email"
        ]

    if not email_call:
        raise ValueError("Email tool call not found.")

    email_call = email_call[0]

    reject_message = ToolMessage(
        content="The user rejected sending this email.",
        tool_call_id=email_call["id"]
    )

    return {
        "messages":[reject_message],
        "approval":False
    }
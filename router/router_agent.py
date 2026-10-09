from agents.node import State
from langgraph.graph import END

def route_agent(state:State):

    last_messages = state.messages[-1]

    if not last_messages.tool_calls:
        return END

    for call in last_messages.tool_calls:
        if call["name"] == "send_email":
            return "approval_node"

    return "tools"


def route_after_approval(state:State):

    if state.approval is True:
        return "tools"

    return "rejection_node"
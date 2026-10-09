from agents.llm import llm_with_tool, tools
from agents.state import graph_builder, State
from langgraph.prebuilt import ToolNode
from langgraph.graph import START, END
from langchain_core.messages import SystemMessage
from agents.prompt import SYSTEM_PROMPT
from langgraph.checkpoint.memory import MemorySaver
from human_approval.approval_node import approval_node
from human_approval.rejection_node import rejection_node
from router.router_agent import route_agent, route_after_approval

memory = MemorySaver()

def agent_node(state:State):

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        *state.messages
    ]

    response = llm_with_tool.invoke(messages)

    return {"messages":[response]}

graph_builder.add_node("agent_node",agent_node)

graph_builder.add_node("tools", ToolNode(tools))

graph_builder.add_node("approval_node",approval_node)

graph_builder.add_node("rejection_node",rejection_node)

graph_builder.add_edge(START, "agent_node")
graph_builder.add_conditional_edges(
    "agent_node",
    route_agent,
    {
        "approval_node":"approval_node",
        "tools":"tools",
        END:END
    }
)
graph_builder.add_conditional_edges(
    "approval_node",
    route_after_approval,
    {
        "tools":"tools",
        "rejection_node":"rejection_node"
    }
)
graph_builder.add_edge("tools","agent_node")
graph_builder.add_edge("rejection_node","agent_node")

graph = graph_builder.compile(checkpointer=memory)
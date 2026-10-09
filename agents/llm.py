from langchain_groq import ChatGroq
from dotenv import load_dotenv
load_dotenv()
from tools.email_tool import send_email
from tools.tavily_tool import tavily_search

tools = [
    tavily_search,
    send_email
]

llm = ChatGroq(model="qwen/qwen3.8-27b")

llm_with_tool = llm.bind_tools(tools)
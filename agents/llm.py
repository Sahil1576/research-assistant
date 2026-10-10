from langchain_mistralai import ChatMistralAI
from dotenv import load_dotenv
load_dotenv()
from tools.email_tool import send_email
from tools.tavily_tool import tavily_search

tools = [
    tavily_search,
    send_email
]

llm = ChatMistralAI(model_name="mistral-small-latest")

llm_with_tool = llm.bind_tools(tools)
from langchain_tavily import TavilySearch
from dotenv import load_dotenv
load_dotenv()
from langchain_core.tools import tool
import os
from rich import print

os.environ["TAVILY_API_KEY"] = os.getenv("TAVILY_API_KEY")

tavily = TavilySearch(
    max_results=5,
    topic="general",
    search_depth="basic"
)

@tool
def tavily_search(query:str)->str:
    """
        Search the web for relevant and up-to-date information using Tavily.

    Use this tool when the user asks for recent news, current information,
    research topics, technical documentation, or information that requires
    searching the internet.

    Args:
        query: A clear and specific search query describing the information
               the user wants to find.

    Returns:
        Relevant web search results that can be used to generate
        an accurate and informative response.
    """


    response = tavily.invoke(query)

    return response

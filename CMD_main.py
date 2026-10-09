from agents.node import graph
from rich import print
from langgraph.types import Command

config = {
    "configurable":{
        "thread_id":"chat1"
    }
}

while True:
    question = input("Ask : ")

    if question.lower() == "exit":
        break

    response = graph.invoke(
        {
            "messages":question
        },
        config=config
    )

    if "__interrupt__" in response:

        approval_data = response["__interrupt__"][0].value

        print("\nEmail Approval required")
        print(f"To:{approval_data["to"]}")
        print(f"Subject:{approval_data["subject"]}")
        print(f"Body:{approval_data["body"]}")

        choice = input("Do you approve for send an email ? (yes/no) ->")

        choice = choice.lower().strip()

        response = graph.invoke(
            Command(resume={"approved":choice}),
            config=config
        )

    print(f"AI : {response["messages"][-1].content}")
from email.message import EmailMessage
from dotenv import load_dotenv
load_dotenv()
import os
from langchain_core.tools import tool
import smtplib

@tool
def send_email(to:str, subject:str, body:str)->str:
    """
    Send the email to the specific recipients.
    """
    try:
        msg = EmailMessage()
        msg["FROM"] = os.environ["EMAIL_ADDRESS"]
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)


        with smtplib.SMTP_SSL("smtp.gmail.com",465) as smtp:
            smtp.login(
            os.environ["EMAIL_ADDRESS"],
            os.environ["EMAIL_APP_PASSWORD"]
        )
        smtp.send_message(msg)

        return f"Email sent successfully to {to}."
    
    except Exception as e:
        return f"Error : {e}"
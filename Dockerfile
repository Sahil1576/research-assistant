FROM python:3.12.10

WORKDIR /Research_Assistant

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY requirements.txt .

RUN uv pip install --system -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn","main_updated:app","--host","0.0.0.0","--port","8000"]
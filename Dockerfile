FROM python:3.11-slim

WORKDIR /app/server

RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

COPY server/requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt hf_transfer
ENV HF_HUB_ENABLE_HF_TRANSFER=1

COPY server/scripts/ scripts/
RUN python scripts/download_models.py
RUN pip uninstall -y accelerate
RUN pip install langchain-google-genai

COPY server/ .

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

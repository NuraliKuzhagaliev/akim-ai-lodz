FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
COPY backend/requirements-ai.txt /app/backend/requirements-ai.txt
RUN pip install --no-cache-dir -r /app/backend/requirements-ai.txt
COPY backend/app /app/backend/app
COPY shared /app/shared
RUN useradd --create-home --uid 10001 akim
USER akim
EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=3s --start-period=10s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2)"
CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]

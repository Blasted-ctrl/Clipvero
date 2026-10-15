FROM ghcr.io/astral-sh/uv:0.13.1 AS uv
FROM python:3.12-slim
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY services ./services
RUN uv sync --frozen --no-dev --no-editable && useradd --uid 10001 --create-home clipvero
USER clipvero
ENV PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["/app/.venv/bin/python", "-m", "uvicorn", "clipvero_api.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]

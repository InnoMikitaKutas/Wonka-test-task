# ATS Analytics service.
# Not wired into the root docker-compose.yml yet, that is a later step.

FROM python:3.13-slim

# Copy the uv binary from the official uv image, so we do not need to
# install uv with pip or curl.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

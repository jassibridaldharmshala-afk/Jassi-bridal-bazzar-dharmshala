FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libglib2.0-0 libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /worker
ENV U2NET_HOME=/worker/models OMP_NUM_THREADS=1
COPY ai-video-worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "from rembg import new_session; new_session('u2netp', providers=['CPUExecutionProvider'])"
COPY ai-video-worker/app ./app

RUN useradd --system --uid 10001 worker \
    && chown -R worker:worker /worker
USER worker

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

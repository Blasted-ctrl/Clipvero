from celery import Celery
from clipvero_api.config import settings
from kombu import Queue

QUEUES = (
    "ai-generation",
    "transcription",
    "asset-generation",
    "video-rendering",
    "publishing",
    "maintenance",
)

app = Celery("clipvero", broker=settings().redis_url, include=["clipvero_workers.maintenance"])
app.conf.update(
    task_queues=[Queue(name) for name in QUEUES],
    task_default_queue="maintenance",
    task_routes={"clipvero.expire_sessions": {"queue": "maintenance"}},
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_ignore_result=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    worker_concurrency=2,
    worker_max_tasks_per_child=100,
    task_soft_time_limit=300,
    task_time_limit=360,
    broker_transport_options={"visibility_timeout": 900},
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "expire-sessions-hourly": {
            "task": "clipvero.expire_sessions",
            "schedule": 3600,
            "options": {"queue": "maintenance"},
        }
    },
)

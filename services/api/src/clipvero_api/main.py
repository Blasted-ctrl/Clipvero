import json
import logging
import time
from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException
from starlette.responses import Response

from clipvero_api.projects import router as project_router
from clipvero_api.routes import router
from clipvero_api.schemas import ErrorResponse
from clipvero_api.security import APIError
from clipvero_api.storage import router as storage_router

logger = logging.getLogger("clipvero.api")
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)


def error(request: Request, status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "error": {"code": code, "message": message},
            "requestId": request.state.request_id,
        },
    )


def create_app() -> FastAPI:
    app = FastAPI(
        title="Clipvero API",
        version="1.0.0",
        responses={code: {"model": ErrorResponse} for code in (401, 403, 404, 409, 422, 429, 503)},
    )

    @app.middleware("http")
    async def request_context(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request.state.request_id = str(uuid4())
        started = time.monotonic()
        response: Response
        length = request.headers.get("content-length", "0")
        if not length.isdigit() or int(length) > 1024 * 1024:
            response = error(request, 413, "BODY_TOO_LARGE", "Request exceeds 1 MB.")
        elif request.method in {"POST", "PATCH", "PUT"} and "content-length" not in request.headers:
            response = error(request, 411, "LENGTH_REQUIRED", "Content-Length is required.")
        else:
            try:
                response = await call_next(request)
            except Exception:
                response = error(request, 500, "INTERNAL_ERROR", "Something went wrong. Try again.")
                logger.error(
                    json.dumps({"event": "request.failed", "requestId": request.state.request_id})
                )
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        logger.info(
            json.dumps(
                {
                    "event": "request.completed",
                    "requestId": request.state.request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "durationMs": round((time.monotonic() - started) * 1000),
                }
            )
        )
        return response

    @app.exception_handler(APIError)
    async def application_error(request: Request, exc: APIError) -> JSONResponse:
        return error(request, exc.status, exc.code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError) -> JSONResponse:
        return error(request, 422, "VALIDATION_ERROR", "Check the supplied fields and try again.")

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return error(
            request, exc.status_code, "HTTP_ERROR", "The requested resource is unavailable."
        )

    @app.exception_handler(SQLAlchemyError)
    @app.exception_handler(RedisError)
    async def dependency_error(request: Request, exc: Exception) -> JSONResponse:
        return error(
            request, 503, "SERVICE_UNAVAILABLE", "A required service is unavailable. Try again."
        )

    app.include_router(router)
    app.include_router(project_router)
    app.include_router(storage_router)
    return app


app = create_app()

from alembic import context
from clipvero_api.db import engine
from clipvero_api.models import Base
from sqlalchemy.engine import Connection

if context.is_offline_mode():
    raise RuntimeError("Run migrations against the configured PostgreSQL database.")


def migrate(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=Base.metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


provided = context.config.attributes.get("connection")
if provided is not None:
    migrate(provided)
else:
    with engine().connect() as connection:
        migrate(connection)

import json
from pathlib import Path

from clipvero_api.main import app

target = Path(__file__).resolve().parents[1] / "packages/shared-types/openapi.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
print("Exported API schema to packages/shared-types/openapi.json")

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import ENV_FILE, settings
from app.main import app


class AppSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self._old_api_key = settings.geoserver_api_key

    def tearDown(self) -> None:
        settings.geoserver_api_key = self._old_api_key

    def test_health_and_openapi_paths(self) -> None:
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})

        paths = self.client.get("/openapi.json").json()["paths"]
        expected = {
            "/api/v1/species/search",
            "/api/v1/species/rank",
            "/api/v1/occurrence/points",
            "/api/v1/occurrence/within",
            "/api/v1/occurrence/buffer",
            "/api/v1/stats/grid",
            "/api/v1/geoserver/layers",
        }
        self.assertTrue(expected.issubset(paths))
        grid_params = {
            item["name"]
            for item in paths["/api/v1/stats/grid"]["get"]["parameters"]
        }
        self.assertIn("max_cells", grid_params)

    def test_env_file_is_resolved_from_backend_dir(self) -> None:
        self.assertEqual(ENV_FILE.name, ".env")
        self.assertEqual(ENV_FILE.parent.name, "backend")

    def test_geoserver_write_requires_api_key_when_configured(self) -> None:
        settings.geoserver_api_key = "secret"
        body = {
            "layer_name": "x",
            "table_name": "y",
            "cql_filter": "month=8 AND year=2024",
        }

        self.assertEqual(self.client.post("/api/v1/geoserver/layers", json=body).status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/v1/geoserver/layers",
                json=body,
                headers={"X-API-Key": "bad"},
            ).status_code,
            401,
        )

        with patch("app.services.geoserver.publish_layer", return_value={"status": "mocked"}) as mocked:
            response = self.client.post(
                "/api/v1/geoserver/layers",
                json=body,
                headers={"X-API-Key": "secret"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "mocked"})
        mocked.assert_called_once_with("x", "y", None, "month=8 AND year=2024")


if __name__ == "__main__":
    unittest.main()

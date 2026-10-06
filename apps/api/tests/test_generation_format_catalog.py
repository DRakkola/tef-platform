"""API contract tests for the server-driven TEF task-format catalogue."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.modules.admin.question_formats import QUESTION_FORMAT_SPECS

ENDPOINT = "/api/v1/admin/content/generation/formats"

EXPECTED_MODULE_COUNTS = {
    "reading": 10,
    "listening": 6,
    "lexique_structure": 4,
    "writing": 2,
    "speaking": 2,
}


@pytest.mark.asyncio
class TestFormatCatalogEndpoint:
    async def test_requires_authentication(self, client: AsyncClient) -> None:
        response = await client.get(ENDPOINT)
        assert response.status_code in (401, 403)

    async def test_forbidden_for_non_admin(
        self,
        client: AsyncClient,
        student_auth_headers: dict[str, str],
    ) -> None:
        """Authoring metadata is an admin capability, not student-visible."""
        response = await client.get(ENDPOINT, headers=student_auth_headers)
        assert response.status_code == 403

    async def test_forbidden_for_teacher(
        self,
        client: AsyncClient,
        teacher_auth_headers: dict[str, str],
    ) -> None:
        response = await client.get(ENDPOINT, headers=teacher_auth_headers)
        assert response.status_code == 403

    async def test_returns_full_catalogue(
        self,
        client: AsyncClient,
        admin_auth_headers: dict[str, str],
    ) -> None:
        response = await client.get(ENDPOINT, headers=admin_auth_headers)
        assert response.status_code == 200

        body = response.json()
        assert body["total_formats"] == len(QUESTION_FORMAT_SPECS) == 24
        assert len(body["formats"]) == 24
        assert len(body["stimulus_kinds"]) > 0

    async def test_module_breakdown_is_authoritative(
        self,
        client: AsyncClient,
        admin_auth_headers: dict[str, str],
    ) -> None:
        response = await client.get(ENDPOINT, headers=admin_auth_headers)
        body = response.json()

        actual = {module["code"]: 0 for module in body["modules"]}
        for entry in body["formats"]:
            actual[entry["module"]] += 1

        assert actual == EXPECTED_MODULE_COUNTS

    async def test_every_entry_carries_authoring_constraints(
        self,
        client: AsyncClient,
        admin_auth_headers: dict[str, str],
    ) -> None:
        response = await client.get(ENDPOINT, headers=admin_auth_headers)
        body = response.json()

        codes = [entry["code"] for entry in body["formats"]]
        assert len(codes) == len(set(codes)), "format codes must be unique"

        for entry in body["formats"]:
            assert entry["name"], f"{entry['code']} must have a human-readable name"
            assert entry["admin_hint"], f"{entry['code']} must explain what it asks"
            assert entry["allowed_response_types"], f"{entry['code']} needs response formats"
            assert entry["default_response_type"] in entry["allowed_response_types"]
            assert entry["module_label"]
            assert entry["stimulus_kind_label"]
            assert entry["option_count_min"] <= entry["option_count_max"]
            if entry["option_count_max"] > 0:
                assert entry["option_count_min"] >= 2

    async def test_matches_registry_exactly(
        self,
        client: AsyncClient,
        admin_auth_headers: dict[str, str],
    ) -> None:
        """The endpoint must never drift from the generator's own registry."""
        response = await client.get(ENDPOINT, headers=admin_auth_headers)
        served = {entry["code"] for entry in response.json()["formats"]}
        assert served == set(QUESTION_FORMAT_SPECS)
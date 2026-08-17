"""Tests for ecosystem_scanner module."""

import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock

# Ensure project root is importable
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.ecosystem_scanner import (
    _parse_git_date,
    _detect_deploy_url,
    _get_git_info,
    _scan_single_project,
    scan_projects,
)


class TestParseGitDate:
    """Tests for _parse_git_date function."""

    def test_iso_format_with_timezone(self):
        """Test parsing ISO format with timezone (git --pretty=%cI)."""
        result = _parse_git_date("2026-07-30T14:30:45+07:00")
        assert result.year == 2026
        assert result.month == 7
        assert result.day == 30

    def test_iso_format_utc(self):
        """Test parsing ISO format UTC."""
        result = _parse_git_date("2026-07-30T14:30:45Z")
        assert result.year == 2026

    def test_git_default_format(self):
        """Test parsing git default format (git --pretty=%ci)."""
        result = _parse_git_date("2026-07-30 14:30:45 +0700")
        assert result.year == 2026
        assert result.month == 7
        assert result.day == 30

    def test_git_default_format_negative_tz(self):
        """Test parsing git default format with negative timezone."""
        result = _parse_git_date("2026-07-30 14:30:45 -0500")
        assert result.year == 2026

    def test_date_only_fallback(self):
        """Test fallback to date-only parsing."""
        result = _parse_git_date("2026-07-30")
        assert result.year == 2026
        assert result.month == 7
        assert result.day == 30

    def test_invalid_date_fallback(self):
        """Test fallback for completely invalid date."""
        result = _parse_git_date("not-a-date")
        # Should return current time (within a few seconds)
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        diff = abs((result - now).total_seconds())
        assert diff < 10  # Within 10 seconds


class TestDetectDeployUrl:
    """Tests for _detect_deploy_url function."""

    def test_vercel_json_alias_list(self, tmp_path):
        """Test detecting deploy URL from vercel.json with alias list."""
        vercel_json = tmp_path / "vercel.json"
        vercel_json.write_text('{"alias": ["myapp.vercel.app", "custom.com"]}')
        result = _detect_deploy_url(str(tmp_path))
        assert result == "https://myapp.vercel.app"

    def test_vercel_json_alias_string(self, tmp_path):
        """Test detecting deploy URL from vercel.json with alias string."""
        vercel_json = tmp_path / "vercel.json"
        vercel_json.write_text('{"alias": "myapp.vercel.app"}')
        result = _detect_deploy_url(str(tmp_path))
        assert result == "https://myapp.vercel.app"

    def test_vercel_json_domains(self, tmp_path):
        """Test detecting deploy URL from vercel.json domains."""
        vercel_json = tmp_path / "vercel.json"
        vercel_json.write_text('{"domains": ["app.example.com"]}')
        result = _detect_deploy_url(str(tmp_path))
        assert result == "https://app.example.com"

    def test_package_json_homepage(self, tmp_path):
        """Test detecting deploy URL from package.json homepage."""
        pkg_json = tmp_path / "package.json"
        pkg_json.write_text('{"homepage": "https://myapp.com"}')
        result = _detect_deploy_url(str(tmp_path))
        assert result == "https://myapp.com"

    def test_package_json_repository(self, tmp_path):
        """Test detecting deploy URL from package.json repository."""
        pkg_json = tmp_path / "package.json"
        pkg_json.write_text('{"repository": {"url": "https://github.com/user/repo"}}')
        result = _detect_deploy_url(str(tmp_path))
        assert result == "https://github.com/user/repo"

    def test_vercel_dir(self, tmp_path):
        """Test detecting vercel deployment from .vercel directory."""
        (tmp_path / ".vercel").mkdir()
        result = _detect_deploy_url(str(tmp_path))
        assert result == "vercel-deployed"

    def test_netlify_dir(self, tmp_path):
        """Test detecting netlify deployment from .netlify directory."""
        (tmp_path / ".netlify").mkdir()
        result = _detect_deploy_url(str(tmp_path))
        assert result == "netlify-deployed"

    def test_none_when_no_config(self, tmp_path):
        """Test returns None when no deploy config found."""
        result = _detect_deploy_url(str(tmp_path))
        assert result is None


class TestParseGitDateIntegration:
    """Integration tests using real git if available."""

    def test_git_info_on_real_repo(self):
        """Test _get_git_info on a real git repo if available."""
        # This test runs in the actual project directory
        from modules.ecosystem_scanner import _get_git_info
        result = _get_git_info("/Users/zaryu/Desktop/Niumination")
        # Should at least return a valid structure
        assert "is_git" in result
        if result["is_git"]:
            assert "branch" in result
            assert "last_commit" in result
            assert "dirty" in result
            assert "remote_url" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
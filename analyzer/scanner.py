"""Scanner adapter: runs the existing analyzer engine (gdpr_analyzer.py)."""

from urllib.parse import urlsplit

from analyzer.target import normalize_target


def run_scan(target_url: str) -> dict:
    """Run all existing analyzer modules and return their combined JSON data."""

    # Imported lazily: pulls in Splinter/Selenium and the analyzer modules.
    from gdpr_analyzer import assess_rank, full, get_content

    target_url = normalize_target(target_url)
    parsed = urlsplit(target_url)

    cookies, html = get_content(target_url)

    result = full(cookies, html, parsed.netloc)

    result["target"] = parsed.netloc
    result["grade"] = assess_rank(result)

    return result

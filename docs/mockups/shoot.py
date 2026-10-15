"""Screenshots of the static mockups in light and dark themes.

Usage: uv run --with playwright python docs/mockups/shoot.py [page.html ...]
Output: docs/mockups/shots/<page>-<theme>.png (full page, 1440px wide).
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
OUT = ROOT / "shots"


def main() -> None:
    pages = sys.argv[1:] or ["index.html", "chapter.html"]
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name in pages:
            path = (ROOT / name).resolve()
            for theme in ("light", "dark"):
                page = browser.new_page(viewport={"width": 1440, "height": 900})
                page.goto(f"{path.as_uri()}?theme={theme}")
                page.wait_for_timeout(800)
                target = OUT / f"{path.stem}-{theme}.png"
                page.screenshot(path=str(target), full_page=True)
                print(target)
                page.close()
        browser.close()


if __name__ == "__main__":
    main()

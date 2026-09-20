"""
Verifies the exported /docs static build served on port 8008.
Tests all 6 views with static data access.
"""

import time
from playwright.sync_api import sync_playwright

def test_static():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page()

        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        print("Testing View 1: Trajectory on static server...")
        page.goto("http://127.0.0.1:8008/", wait_until="networkidle")
        page.fill("#plate-query-input", "TN09CB1234")
        page.click("#btn-search-plate")
        page.wait_for_selector("#traj-table-container", timeout=6000)
        time.sleep(0.5)

        print("Testing View 2: Heatmap on static server...")
        page.click("a[data-view='heatmap']")
        page.wait_for_selector("#heatmap-table-container", timeout=6000)
        time.sleep(0.5)

        print("Testing View 3: Blacklist on static server...")
        page.click("a[data-view='blacklist']")
        page.fill("#bl-input", "TN07AX4521")
        page.click("#blacklist-form button[type='submit']")
        page.wait_for_selector(".badge-critical", timeout=6000)
        time.sleep(0.5)

        print("Testing View 4: Alerts on static server...")
        page.click("a[data-view='alerts']")
        page.wait_for_selector("#alerts-table-container", timeout=6000)
        time.sleep(0.5)

        print("Testing View 5: Trends on static server...")
        page.click("a[data-view='trends']")
        page.wait_for_selector("#corridor-table-container", timeout=6000)
        time.sleep(0.5)

        print("Testing View 6: Cameras on static server...")
        page.click("a[data-view='cameras']")
        page.wait_for_selector("#cameras-table-container", timeout=6000)
        time.sleep(0.5)

        browser.close()

    print("Static build test complete. Console errors:", len(errors))
    if errors:
        for err in errors:
            print("  -", err)
        return False
    return True

if __name__ == "__main__":
    success = test_static()
    exit(0 if success else 1)

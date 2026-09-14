"""
Automated Verification Suite (CHECK 1, CHECK 2, and CHECK 4).
Runs through all views using headless Edge:
- Functional walkthrough of all 5 views
- Captures browser console errors (asserts 0 errors)
- Tests role toggle (Operator vs Supervisor DOM unmounting)
- Tests alert toast while on a different view + mute toggle
- Captures full screenshots for all views into docs/screenshots/
"""

import os
import sys
import time
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "docs", "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def run_tests():
    console_errors = []
    uncaught_exceptions = []

    print("Launching browser for verification walkthrough...")
    with sync_playwright() as p:
        # Launch MS Edge
        browser = p.chromium.launch(channel="msedge", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Listen for console errors
        def on_console(msg):
            if msg.type == "error":
                # Filter benign network aborts if any
                console_errors.append(msg.text)
                print(f"[CONSOLE ERROR]: {msg.text}")

        def on_pageerror(err):
            uncaught_exceptions.append(str(err))
            print(f"[UNCAUGHT EXCEPTION]: {str(err)}")

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)

        print("\n--- VIEW 1: Trajectory Search ---")
        page.goto("http://127.0.0.1:8000/", wait_until="networkidle")
        time.sleep(1)

        # Search for route anomaly vehicle KA03MD5522
        page.fill("#traj-query", "KA03MD5522")
        page.click("#traj-form button[type='submit']")
        page.wait_for_selector("#traj-table-container table", timeout=5000)
        time.sleep(1)

        # Expand anomaly row
        expandable = page.query_selector(".expandable-row.highlighted")
        if expandable:
            expandable.click()
            time.sleep(0.5)

        p1 = os.path.join(SCREENSHOTS_DIR, "01_trajectory_search.png")
        page.screenshot(path=p1)
        print(f"Captured: {p1}")

        print("\n--- VIEW 2: Heatmap ---")
        page.click("a[data-view='heatmap']")
        page.wait_for_selector("#heatmap-table-container table", timeout=5000)
        time.sleep(1)

        p2 = os.path.join(SCREENSHOTS_DIR, "02_heatmap_view.png")
        page.screenshot(path=p2)
        print(f"Captured: {p2}")

        print("\n--- VIEW 3: Blacklist Check ---")
        page.click("a[data-view='blacklist']")
        page.wait_for_selector("#blacklist-form", timeout=5000)
        
        # Test wanted plate match
        page.fill("#bl-input", "TN07AX4521")
        page.click("#blacklist-form button[type='submit']")
        page.wait_for_selector(".badge-critical", timeout=5000)
        time.sleep(0.5)

        p3 = os.path.join(SCREENSHOTS_DIR, "03_blacklist_view.png")
        page.screenshot(path=p3)
        print(f"Captured: {p3}")

        print("\n--- VIEW 4: Alerts & Supervisor Audit Log ---")
        page.click("a[data-view='alerts']")
        page.wait_for_selector("#alerts-table-container table", timeout=5000)
        time.sleep(1)

        # Confirm operator mode has no audit log in DOM
        audit_mount = page.query_selector("#audit-log-mount-point .card")
        assert audit_mount is None, "Audit Log should be unmounted in Operator mode"
        print("Confirmed: Audit log is NOT present in DOM during Operator mode.")

        # Switch to Supervisor mode
        page.select_option("#role-selector", "supervisor")
        time.sleep(1)
        page.wait_for_selector("#audit-table-container table", timeout=5000)
        print("Confirmed: Audit log mounted and populated in Supervisor mode.")

        p4 = os.path.join(SCREENSHOTS_DIR, "04_alerts_supervisor.png")
        page.screenshot(path=p4)
        print(f"Captured: {p4}")

        print("\n--- VIEW 5: Traffic Trends ---")
        page.click("a[data-view='trends']")
        page.wait_for_selector("#trends-chart-container svg", timeout=5000)
        page.wait_for_selector("#corridor-table-container table", timeout=5000)
        time.sleep(1)

        p5 = os.path.join(SCREENSHOTS_DIR, "05_traffic_trends.png")
        page.screenshot(path=p5)
        print(f"Captured: {p5}")

        print("\n--- GLOBAL TOAST & MUTE ON DIFFERENT VIEW ---")
        # Click mute toggle
        page.click("#btn-mute-toggle")
        mute_text = page.text_content("#btn-mute-toggle")
        assert "MUTED" in mute_text, "Mute button should show MUTED"
        print(f"Confirmed: Mute button toggled state: {mute_text}")

        # Trigger toast on Trends view
        page.evaluate("""
          window.toastManager.showToast({
            alert_id: 999,
            alert_type: 'clone',
            detail_text: 'Simultaneous sighting conflict: Plate TN10BE9876 sighted at CAM_01 and CAM_07 within 120s across 7.5 km (required speed 225.0 km/h).',
            created_at: new Date().toISOString()
          });
        """)
        time.sleep(0.5)
        page.wait_for_selector("#toast-container .toast", timeout=3000)
        print("Confirmed: Toast notification appeared globally while on Traffic Trends view.")

        p6 = os.path.join(SCREENSHOTS_DIR, "06_toast_notification.png")
        page.screenshot(path=p6)
        print(f"Captured: {p6}")

        print("\n--- DELIBERATE EDGE CASES ---")
        # Edge case 1: Nonexistent plate search in Trajectory
        page.click("a[data-view='trajectory']")
        page.fill("#traj-query", "ZZ99ZZ9999")
        page.click("#traj-form button[type='submit']")
        time.sleep(1)
        res_text = page.text_content("#traj-table-container")
        assert "No trajectory found" in res_text, "Should show 'No trajectory found'"
        print("Confirmed Edge Case 1: Nonexistent plate handled gracefully.")

        # Edge case 2: Clean plate in Blacklist
        page.click("a[data-view='blacklist']")
        page.fill("#bl-input", "CLEAN1234")
        page.click("#blacklist-form button[type='submit']")
        time.sleep(1)
        bl_text = page.text_content("#blacklist-result-container")
        assert "NO WATCHLIST MATCH" in bl_text, "Should show clean no match"
        print("Confirmed Edge Case 2: Clean plate blacklist check handled gracefully.")

        browser.close()

    print("\n================ VERIFICATION SUMMARY ================")
    print(f"Console Errors: {len(console_errors)}")
    print(f"Uncaught Exceptions: {len(uncaught_exceptions)}")
    if console_errors or uncaught_exceptions:
        print("FAILED: Browser console errors detected:")
        for e in console_errors:
            print("  -", e)
        for e in uncaught_exceptions:
            print("  -", e)
        return False
    else:
        print("PASSED: Zero console errors, zero uncaught exceptions!")
        print("All functional walkthrough steps and role gating verified.")
        return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

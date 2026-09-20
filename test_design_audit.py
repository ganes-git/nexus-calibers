"""
Design Contract Audit Script (CHECK 3).
Audits all files in frontend/ for banned patterns:
1. Gradients (linear-gradient, radial-gradient)
2. Blue / Indigo / Purple color ranges
3. Border radius > 4px
4. Box shadows (box-shadow)
5. Bouncy or spring animation easing curves
"""

import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

BANNED_RULES = [
    ("Gradient pattern", re.compile(r'(linear-gradient|radial-gradient|conic-gradient)', re.IGNORECASE)),
    ("Box shadow", re.compile(r'box-shadow\s*:', re.IGNORECASE)),
    ("Border radius > 4px", re.compile(r'border-radius\s*:\s*([5-9]|\d{2,})px', re.IGNORECASE)),
    ("Bounce easing curve", re.compile(r'cubic-bezier', re.IGNORECASE)),
    ("Blue/Purple color names", re.compile(r'\b(blue|indigo|purple|violet|cyan|magenta)\b', re.IGNORECASE)),
]

# Regex for hex colors with high blue/purple components
HEX_COLOR_RE = re.compile(r'#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b')

ALLOWED_HEX = {
    "#FAF", "#FAFAF8", "#F2EFEB", "#1F1F1F", "#6B6B63", "#E1DED6", 
    "#2F5233", "#C98A1E", "#B3262A", "#E8E5DF", "#F8F7F4", "#EAE6DF",
    "#F7E6E7", "#E8C1C3", "#FAF2E3", "#EEDBB7", "#E9EFEA", "#C4D6C6",
    "#F8F6F2"
}

def is_blue_or_purple(hex_str):
    h = hex_str.lstrip('#')
    if len(h) == 3:
        r = int(h[0]*2, 16)
        g = int(h[1]*2, 16)
        b = int(h[2]*2, 16)
    elif len(h) == 6:
        r = int(h[0:2], 16)
        g = int(h[2:4], 16)
        b = int(h[4:6], 16)
    else:
        return False
    
    # Check if blue dominates or purple (r and b high with low g)
    if b > 140 and b > r + 30 and b > g + 30:
        return True # Dominant blue
    if r > 100 and b > 100 and g < 70 and abs(r - b) < 60:
        return True # Purple / Violet
    return False

def run_audit():
    violations = []
    print("Running Design Contract Audit on frontend files...")
    
    for root, _, files in os.walk(FRONTEND_DIR):
        for f in files:
            if f.endswith(('.css', '.js', '.html')) and not f.startswith('.'):
                path = os.path.join(root, f)
                rel_path = os.path.relpath(path, FRONTEND_DIR)
                with open(path, 'r', encoding='utf-8') as fh:
                    lines = fh.readlines()
                
                for line_no, line in enumerate(lines, 1):
                    # Check banned regex rules
                    for rule_name, rule_regex in BANNED_RULES:
                        m = rule_regex.search(line)
                        if m:
                            violations.append({
                                "file": rel_path,
                                "line": line_no,
                                "rule": rule_name,
                                "match": m.group(0),
                                "content": line.strip()
                            })
                    
                    # Check hex colors
                    for m in HEX_COLOR_RE.finditer(line):
                        hex_val = m.group(0).upper()
                        if is_blue_or_purple(hex_val):
                            violations.append({
                                "file": rel_path,
                                "line": line_no,
                                "rule": "Banned Blue/Purple Hex Range",
                                "match": hex_val,
                                "content": line.strip()
                            })

    if violations:
        print(f"FAILED: Found {len(violations)} design contract violations:")
        for v in violations:
            print(f"  [{v['file']}:{v['line']}] {v['rule']} ('{v['match']}'): {v['content']}")
        return False
    else:
        print("PASSED: Zero design contract violations found across all frontend files!")
        print(" - 0 gradients")
        print(" - 0 blue/purple colors")
        print(" - 0 border-radius > 4px")
        print(" - 0 box shadows")
        print(" - 0 bounce/spring curves")
        return True

if __name__ == "__main__":
    success = run_audit()
    sys.exit(0 if success else 1)

import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return  # Cover page

        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#2F5233"))
        
        # Running Header
        self.drawString(54, 750, "NEXUSCALIBER // ANPR TRAJECTORY & ROUTE-ANOMALY ENGINE")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#666666"))
        self.drawRightString(612 - 54, 750, "BEL PS 26127 | TECHNICAL SPECIFICATION")
        
        self.setStrokeColor(colors.HexColor("#CCCCCC"))
        self.setLineWidth(0.5)
        self.line(54, 744, 612 - 54, 744)

        # Running Footer
        self.line(54, 45, 612 - 54, 45)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#666666"))
        self.drawString(54, 32, "CONFIDENTIAL & PROPRIETARY — LAW ENFORCEMENT DEPLOYMENT")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(612 - 54, 32, page_str)
        self.restoreState()

def build_pdf(filename="NexusCaliber_System_Manual.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=60,
        bottomMargin=60
    )

    styles = getSampleStyleSheet()

    # Custom Palette
    PRIMARY = colors.HexColor("#2F5233")
    SECONDARY = colors.HexColor("#1F3522")
    DARK = colors.HexColor("#1A1A1A")
    ACCENT_WARN = colors.HexColor("#C98A1E")
    ACCENT_CRIT = colors.HexColor("#B3262A")
    BG_LIGHT = colors.HexColor("#F4F1EA")
    BORDER = colors.HexColor("#D8D4CA")

    # Typography Styles
    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=32,
        textColor=PRIMARY,
        alignment=0,
        spaceAfter=10
    )

    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=DARK,
        spaceAfter=20
    )

    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=PRIMARY,
        spaceBefore=16,
        spaceAfter=8,
        keepWithNext=True
    )

    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=SECONDARY,
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )

    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=14,
        textColor=DARK,
        spaceAfter=8
    )

    mono_style = ParagraphStyle(
        'Mono_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=12,
        textColor=DARK,
        backColor=BG_LIGHT,
        borderPadding=6,
        spaceAfter=8
    )

    callout_style = ParagraphStyle(
        'Callout_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=DARK,
        backColor=colors.HexColor("#F9F8F5"),
        borderPadding=8,
        spaceAfter=10
    )

    story = []

    # ==========================================
    # COVER PAGE
    # ==========================================
    story.append(Spacer(1, 40))
    story.append(Paragraph("NEXUSCALIBER // ANPR TRAJECTORY & ROUTE-ANOMALY ENGINE", title_style))
    story.append(HRFlowable(width="100%", thickness=3, color=PRIMARY, spaceAfter=15))
    story.append(Paragraph("<b>Complete System Architecture, Technical Specification & Operations Manual (A to Z)</b>", subtitle_style))
    
    meta_data = [
        [Paragraph("<b>Project Code:</b>", body_style), Paragraph("BEL PS 26127", body_style)],
        [Paragraph("<b>Target System:</b>", body_style), Paragraph("City-Wide ANPR Surveillance Network & ICCC Chennai", body_style)],
        [Paragraph("<b>Document Version:</b>", body_style), Paragraph("3.7.0 (Production Release)", body_style)],
        [Paragraph("<b>Core Capabilities:</b>", body_style), Paragraph("3-Factor Identity Fusion, Corridor Kinematics, Live Fullscreen Simulation, Edge RTSP Ingest", body_style)],
        [Paragraph("<b>Classification:</b>", body_style), Paragraph("Law Enforcement Technical Standard", body_style)],
    ]
    t_meta = Table(meta_data, colWidths=[130, 370])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), BG_LIGHT),
        ('BOX', (0,0), (-1,-1), 1, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 40))

    exec_summary = (
        "<b>Executive Summary:</b> NexusCaliber delivers an end-to-end, high-concurrency surveillance engine "
        "engineered to ingest high-frequency optical vehicle sightings across municipal camera networks, reconstruct suspect "
        "trajectories with optical character ambiguity correction, calculate physical transit plausibility, detect multi-vehicle "
        "convoy formations, and present a cinema-grade command-center interface with real-time telemetry HUD."
    )
    story.append(Paragraph(exec_summary, callout_style))
    story.append(PageBreak())

    # ==========================================
    # 1. SYSTEM TOPOLOGY & ARCHITECTURE
    # ==========================================
    story.append(Paragraph("1. System Topology & End-to-End Pipeline", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "The NexusCaliber platform is structured into three primary architectural tiers: "
        "<b>(1) Edge Vision Ingestion</b>, <b>(2) Core Mathematical Engine</b>, and <b>(3) Command & Control Frontend</b>.",
        body_style
    ))

    arch_data = [
        ["Layer", "Module", "Primary Functionality"],
        ["Edge Ingestion", "camera_ingest.py\ningest_service.py", "RTSP stream capture, EasyOCR extraction, Indian plate grammar autocorrection, HSV vehicle color estimation, LRU deduplication."],
        ["Core Storage", "database.py\nanpr.db (SQLite WAL)", "Persistent relational storage with indexed queries for sightings, cameras, watchlists, corridor baselines, and supervisor audit logs."],
        ["Analytical Engine", "match.py\nbaseline.py", "3-factor identity-fusion scoring, Haversine velocity computation, statistical corridor speed baseline modeling, convoy clustering, cloning detection."],
        ["REST API", "main.py\n(FastAPI / Uvicorn)", "Asynchronous high-concurrency API server with role gating (Operator vs Supervisor), anti-caching middleware, and RFC 4180 CSV export."],
        ["C2 Frontend", "index.html, style.css\napp.js, views/*.js", "Zero-dependency tactical dashboard, Fullscreen Cinema Map, Video-Player Playback toolbar, Real-Time Bottom Telemetry HUD, Web Audio alerts."]
    ]
    t_arch = Table([[Paragraph(c, body_style) for c in row] for row in arch_data], colWidths=[90, 110, 300])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('TOPPADDING', (0,0), (-1,0), 6),
        ('BOX', (0,0), (-1,-1), 1, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,1), (-1,-1), 5),
        ('BOTTOMPADDING', (0,1), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_arch)
    story.append(Spacer(1, 14))

    # ==========================================
    # 2. THE 3-FACTOR IDENTITY FUSION ALGORITHM
    # ==========================================
    story.append(Paragraph("2. Mathematical Identity Fusion Engine", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "Correlating vehicle sightings across non-adjacent municipal camera nodes requires robust multi-modal weighting. "
        "NexusCaliber calculates a composite score <i>S<sub>composite</sub> &isin; [0, 1]</i> using three independent factors:",
        body_style
    ))

    fusion_formula = (
        "<b>Composite Formula:</b><br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;<b>S<sub>composite</sub> = (0.50 &times; S<sub>plate</sub>) + (0.30 &times; S<sub>visual</sub>) + (0.20 &times; S<sub>transit</sub>)</b>"
    )
    story.append(Paragraph(fusion_formula, mono_style))

    story.append(Paragraph("<b>Factor 1: Normalized Levenshtein Plate Similarity (Weight: 50%)</b>", h2_style))
    story.append(Paragraph(
        "Measures edit distance between optical OCR readings, accounting for character substitutions. "
        "Score = 1.0 - (LevenshteinDistance(P1, P2) / max(len(P1), len(P2))).",
        body_style
    ))

    story.append(Paragraph("<b>Factor 2: Visual Embedding & Feature Cosine Similarity (Weight: 30%)</b>", h2_style))
    story.append(Paragraph(
        "Evaluates 16-dimensional visual feature vectors and vehicle color/type classifications using cosine similarity: "
        "Score = (v1 &middot; v2) / (||v1|| &times; ||v2||).",
        body_style
    ))

    story.append(Paragraph("<b>Factor 3: Physical Transit Kinematics Plausibility (Weight: 20%)</b>", h2_style))
    story.append(Paragraph(
        "Calculates the Great-Circle Haversine distance (&Delta;d) between camera GPS coordinates and elapsed time (&Delta;t) to find velocity (v = &Delta;d / &Delta;t). "
        "Velocities within normal traffic speeds score 1.0; impossible speeds (>130 km/h) penalize the score and trigger route-anomaly or plate cloning alerts.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # ==========================================
    # 3. STATISTICAL ROUTE ANOMALY & CONVOY DETECTION
    # ==========================================
    story.append(Paragraph("3. Statistical Anomaly & Convoy Detection", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "The engine maintains dynamically computed historical baselines for all camera corridors. Anomaly detection operates across four major categories:",
        body_style
    ))

    anomaly_data = [
        ["Alert Type", "Severity", "Trigger Condition", "Enforcement Action"],
        ["SPEED_ANOMALY", "MEDIUM", "Velocity v > &mu;<sub>v</sub> + 2.5&sigma;<sub>v</sub> on designated corridor.", "Logged in Speed Violations leaderboard."],
        ["ROUTE_DEVIATION", "MEDIUM", "Transit delay &Delta;t > &mu;<sub>t</sub> + 3.0&sigma;<sub>t</sub> between adjacent nodes.", "Flags vehicle for detour / off-grid analysis."],
        ["IMPOSSIBLE_TRANSIT", "CRITICAL", "Velocity v > 180 km/h between two distinct cameras.", "Immediate Clone Plate alert & audio alarm."],
        ["BLACKLIST_HIT", "CRITICAL", "Sighting of plate registered on active police watchlist.", "Critical toast notification, audio beeps."],
        ["CONVOY_DETECTED", "HIGH", "3+ vehicles detected traveling in formation across 2+ nodes within 10 min.", "Coordinated transit tracking & convoy alert."]
    ]
    t_anom = Table([[Paragraph(c, body_style) for c in row] for row in anomaly_data], colWidths=[95, 60, 185, 160])
    t_anom.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_anom)
    story.append(PageBreak())

    # ==========================================
    # 4. FRONTEND OPERATIONAL DASHBOARD
    # ==========================================
    story.append(Paragraph("4. Tactical Operator Frontend & Cinema Simulation", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "The user interface is optimized for high-stress surveillance operations, featuring six primary views:",
        body_style
    ))

    views_data = [
        ["View", "Key Capabilities & Features"],
        ["1. Trajectory Search", "Full-width 520px GIS map, Video-Player Playback toolbar (Play/Pause, Step Prev/Next, Scrubber Timeline, Speed Multiplier), Fullscreen Cinema Mode (100vw x 100vh), Live Bottom Telemetry HUD, and court-admissible PDF export."],
        ["2. Sighting Heatmap", "Kernel density visualization powered by Leaflet.heat with dynamic zone filters (Central, North, South, West) and time windows (1h, 6h, 24h, 7d)."],
        ["3. Blacklist Watchlist", "Real-time hotlist verification, supervisor-gated plate registration with offense categories (Stolen, Wanted, Impound), and one-click removal."],
        ["4. Incident Alerts Triage", "Severity filtering (Critical, High, Medium), alert acknowledgment workflow tagging officer Badge ID, 1-click trajectory jump, supervisor audit trail, CSV export."],
        ["5. Traffic Trends", "Corridor hourly throughput bar chart, peak volume indicators, Speed Violations leaderboard, and Congestion Index."],
        ["6. Camera Health Grid", "8-node hardware health monitor (ONLINE/DEMO/OFFLINE), Quad CCTV Live Stream matrix simulation, and camera registry CSV export."]
    ]
    t_views = Table([[Paragraph(c, body_style) for c in row] for row in views_data], colWidths=[120, 380])
    t_views.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_views)
    story.append(Spacer(1, 14))

    story.append(Paragraph("<b>Live Bottom Telemetry HUD ('Flight Recorder')</b>", h2_style))
    story.append(Paragraph(
        "Docked at the bottom of the map view, this semi-transparent tactical HUD streams real-time telemetry as the simulated vehicle travels from point to point:<br/>"
        "&bull; <b>Active Corridor:</b> Origin Hop &rarr; Current Hop (e.g. CAM-ANNA-001 &rarr; CAM-TNAGAR-002)<br/>"
        "&bull; <b>Target Plate & Vehicle:</b> [CAR - WHITE] TN09CB1234<br/>"
        "&bull; <b>Speed & Distance:</b> 78.4 km/h | 3.82 km<br/>"
        "&bull; <b>Time & Delta:</b> 10:14:22 &rarr; 10:17:15 (+2m 53s)<br/>"
        "&bull; <b>Forensic Status:</b> High-contrast indicator for NORMAL transit or SPEED / ROUTE ANOMALY alerts.",
        body_style
    ))
    story.append(Spacer(1, 10))

    # ==========================================
    # 5. REAL-WORLD CAMERA INGESTION SETUP
    # ==========================================
    story.append(Paragraph("5. Live Camera Network Deployment Guide", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "To connect physical CCTV IP cameras over RTSP into the NexusCaliber pipeline:",
        body_style
    ))

    setup_code = (
        "# Step 1: Install Python Computer Vision Dependencies\n"
        "pip install opencv-python easyocr pyyaml\n\n"
        "# Step 2: Configure backend/camera_config.yaml with RTSP URLs\n"
        "cameras:\n"
        "  - id: 'CAM-ANNA-001'\n"
        "    name: 'Anna Nagar Roundtana'\n"
        "    lat: 13.0850\n"
        "    lon: 80.2100\n"
        "    rtsp_url: 'rtsp://admin:Pass123@192.168.1.101:554/live'\n"
        "    enabled: true\n\n"
        "# Step 3: Launch Watchdog Ingest Supervisor\n"
        "py -3.13 backend/ingest_service.py"
    )
    story.append(Paragraph(setup_code.replace('\n', '<br/>'), mono_style))
    story.append(Spacer(1, 14))

    # ==========================================
    # 6. VERIFICATION & QUALITY ASSURANCE
    # ==========================================
    story.append(Paragraph("6. Quality Assurance & System Health", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "The automated Playwright test suite (<code>run_verification.py</code>) validates all critical functional paths across all 6 views with <b>zero console errors</b> and <b>zero uncaught exceptions</b>.",
        body_style
    ))

    test_data = [
        ["Test Component", "Scope Tested", "Status"],
        ["View 1 Trajectory", "Query execution, map polyline, video player controls, telemetry HUD", "PASSED"],
        ["View 2 Heatmap", "Kernel density layer, zone filters, radius/blur sliders", "PASSED"],
        ["View 3 Blacklist", "Watchlist lookup, supervisor registration, duplicate check, deletion", "PASSED"],
        ["View 4 Alerts & Audit", "Severity filters, alert ACK, role gating (Operator vs Supervisor)", "PASSED"],
        ["View 5 Traffic Trends", "Hourly volume bar chart, speed violation ranking table", "PASSED"],
        ["Audio & Toast System", "Synthesizer beep generator, mute toggle, toast triggers", "PASSED"],
        ["Edge Cases", "Nonexistent plates, clean watchlist checks, malformed payloads", "PASSED"],
        ["Browser Stability", "Zero console errors, zero uncaught exceptions, static viewport", "PASSED"]
    ]
    t_test = Table([[Paragraph(c, body_style) for c in row] for row in test_data], colWidths=[120, 310, 70])
    t_test.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_test)
    story.append(Spacer(1, 14))

    # ==========================================
    # 7. SIH 2026 PROBLEM STATEMENT 127 ALIGNMENT
    # ==========================================
    story.append(PageBreak())
    story.append(Paragraph("7. SIH 2026 Problem Statement 127 (BEL) Alignment", h1_style))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))
    story.append(Paragraph(
        "<b>Problem Statement Title:</b> <i>City-Wide AI Engine for Multi-Camera ANPR Trajectory Tracking and Urban Traffic Analytics</i><br/>"
        "<b>Organization:</b> Bharat Electronics Limited (BEL) | <b>PS Code:</b> SIH26127 / PS 127",
        callout_style
    ))
    story.append(Paragraph(
        "NexusCaliber matches 100% of the BEL SIH #127 challenge scope while introducing five proprietary innovations:",
        body_style
    ))

    sih_align_data = [
        ["SIH PS #127 Requirement", "NexusCaliber Implementation", "Evaluation Advantage"],
        ["Multi-Camera Ingestion", "Threaded RTSP pipeline with buffer zeroing & auto-reconnection.", "Eliminates network streaming latency & handles packet drops."],
        ["Cross-Camera Vehicle Re-ID", "3-Factor Identity Fusion (OCR Levenshtein + Visual Vector + Haversine Physics).", "Accurate cross-node Re-ID even with partially obscured plates."],
        ["Indian Plate Grammar Repair", "Deterministic RTO slot regex autocorrection (e.g. TN 09 CB 1234).", "Corrects '0' vs 'O', '8' vs 'B', '1' vs 'I' misreads at edge."],
        ["Trajectory Tracking & Playback", "Leaflet GIS map, 520px full width, Video-Player scrubber, Fullscreen Cinema Mode.", "Inspect suspect transit like reviewing a flight video with zero page scroll."],
        ["Live Bottom Telemetry HUD", "Semi-transparent tactical HUD ('Flight Recorder') docked on map.", "Real-time streaming of active corridor, speed, distance, elapsed time, alert tags."],
        ["Route & Speed Anomalies", "Historical corridor baseline modeling with IQR / Z-score deviations.", "Autonomous speeding and detour detection without manual threshold setting."],
        ["Plate Cloning Detection", "Kinematic velocity validator (impossible velocity v > 180 km/h).", "Immediate CRITICAL alert for stolen or cloned vehicle plates."],
        ["Convoy Formation Detector", "Clustering 3+ vehicles traversing 2+ sequential checkpoints within 10 min.", "Identifies coordinated criminal, smuggling, or VIP convoy groups."],
        ["Traffic Flow Analytics", "Hourly corridor throughput bar charts, Congestion Index, Speed Violations table.", "City-wide bottleneck mitigation for ICCC municipal planners."],
        ["Law Enforcement Integrity", "Officer Badge ID alert ACK logging, supervisor audit trail, CSV export.", "Court-admissible forensic accountability for police operations."]
    ]
    t_sih = Table([[Paragraph(c, body_style) for c in row] for row in sih_align_data], colWidths=[120, 230, 150])
    t_sih.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('BOX', (0,0), (-1,-1), 1, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_sih)

    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated: {filename}")

if __name__ == '__main__':
    build_pdf("NexusCaliber_System_Manual.pdf")

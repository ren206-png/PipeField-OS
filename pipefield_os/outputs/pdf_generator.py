"""
PipeField OS — WeasyPrint PDF Report Generator
Generates engineering-quality PDF reports from calculation output.
"""

import os
from datetime import datetime
from pathlib import Path

REPORTS_DIR = Path(__file__).parent.parent / "reports"

ENGINEERING_NOTICE = (
    "<strong>ENGINEERING NOTICE:</strong> This tool supplements engineering judgment "
    "and field execution. It does not replace Professional Engineering review where "
    "required by code, regulation, or project specification."
)

REPORT_TITLES = {
    "engineering":  "Engineering Report — Pipe Support Calculation",
    "field_sheet":  "Field Support Sheet",
    "cut_sheet":    "Fabrication Cut Sheet",
    "hydrotest":    "Hydrotest Support Report",
    "turnaround":   "Turnaround Remediation Report",
}

FILENAME_PATTERNS = {
    "engineering": "{pid}_engineering_report_{date}.pdf",
    "field_sheet": "{pid}_field_support_{date}.pdf",
    "cut_sheet":   "{pid}_cutsheet_{date}.pdf",
    "hydrotest":   "{pid}_hydrotest_{date}.pdf",
    "turnaround":  "{pid}_turnaround_{date}.pdf",
}

CSS = """
@page { size: letter; margin: 1in; }
body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a2e; }
h1 { color: #0a0d12; font-size: 16pt; border-bottom: 2px solid #f97316; padding-bottom: 6px; }
h2 { color: #0a0d12; font-size: 12pt; margin-top: 18px; border-left: 4px solid #f97316; padding-left: 8px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
th { background: #0a0d12; color: white; padding: 6px 8px; text-align: left; font-size: 9pt; }
td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 9pt; }
tr:nth-child(even) td { background: #f9fafb; }
.notice { background: #fff7ed; border: 1px solid #f97316; border-radius: 4px;
          padding: 10px 14px; margin: 14px 0; font-size: 9pt; }
.pass { color: #16a34a; font-weight: bold; }
.fail { color: #dc2626; font-weight: bold; }
.warn { color: #d97706; font-weight: bold; }
.header-meta { font-size: 9pt; color: #6b7280; margin-bottom: 16px; }
"""


def _html_header(title: str, project_id: str, calc_id: str) -> str:
    date_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    return f"""
    <h1>PipeField OS — {title}</h1>
    <div class="header-meta">
        Project: {project_id} &nbsp;|&nbsp; Calc ID: {calc_id} &nbsp;|&nbsp; Generated: {date_str}
    </div>
    <div class="notice">{ENGINEERING_NOTICE}</div>
    """


def _section(title: str, rows: list[tuple]) -> str:
    html = f"<h2>{title}</h2><table><tbody>"
    for label, value in rows:
        html += f"<tr><td><strong>{label}</strong></td><td>{value}</td></tr>"
    html += "</tbody></table>"
    return html


def _build_engineering_html(calc) -> str:
    inp = calc.input_json or {}
    out = calc.output_json or {}
    dims = out.get("dimensions", {})
    weights = out.get("weights", {})
    span = out.get("span", {})
    slope = out.get("slope", {})
    hydrotest = out.get("hydrotest", {})
    weld = out.get("weld_clearance", {})

    html = _html_header(REPORT_TITLES["engineering"], calc.project_id, calc.calc_id)

    # System Config
    html += _section("1. System Configuration", [
        ("Project ID",       calc.project_id),
        ("Line Number",      inp.get("line_number", "—")),
        ("Spool ID",         inp.get("spool_id", "—")),
        ("Pipe Size (NPS)",  inp.get("nps", "—")),
        ("Schedule",         inp.get("schedule", "—")),
        ("Material",         inp.get("material", "—")),
        ("Fluid Service",    inp.get("fluid", "—")),
        ("Design Basis",     inp.get("design_basis", "—")),
        ("Project Phase",    inp.get("project_phase", "—")),
    ])

    # Pipe Dimensions
    html += _section("2. Pipe Dimensions", [
        ("Outside Diameter (OD)", f'{dims.get("OD_in", "—")} in'),
        ("Wall Thickness",        f'{dims.get("wall_in", "—")} in'),
        ("Inside Diameter (ID)",  f'{dims.get("ID_in", "—")} in'),
    ])

    # Load Summary
    html += _section("3. Load Summary", [
        ("Metal Weight",         f'{weights.get("metal_lbft", "—")} lb/ft'),
        ("Fluid Weight",         f'{weights.get("fluid_lbft", "—")} lb/ft'),
        ("Insulation Weight",    f'{weights.get("insulation_lbft", "—")} lb/ft'),
        ("Total Operating Weight", f'<strong>{weights.get("total_lbft", "—")} lb/ft</strong>'),
    ])

    # Support Layout
    weld_pass = "PASS" if weld.get("pass", True) else "FAIL"
    weld_class = "pass" if weld.get("pass", True) else "fail"
    html += _section("4. Support Layout", [
        ("Calculated Span",    f'{span.get("calculated_ft", "—")} ft'),
        ("Recommended Span",   f'{span.get("recommended_ft", "—")} ft'),
        ("Company Std Span",   f'{span.get("company_ft", "—")} ft'),
        ("Selected Span",      f'<strong>{span.get("selected_ft", "—")} ft</strong>'),
        ("Moment of Inertia",  f'{span.get("moment_of_inertia_in4", "—")} in⁴'),
        ("Elastic Modulus",    f'{span.get("elastic_modulus_psi", "—"):,} psi'),
        ("Allowable Deflection", f'{inp.get("deflection_allow_in", 0.10)} in'),
    ])

    # Weld Clearance
    conflicts = weld.get("conflicts", [])
    conflict_rows = [(f"Conflict {i+1}", f'Support at {c["original_ft"]:.2f} ft near weld at {c["weld_ft"]:.2f} ft — shifted {c["shifted_by_in"]:.3f}"')
                     for i, c in enumerate(conflicts)]
    html += _section("5. Weld Clearance Review", [
        ("Status", f'<span class="{weld_class}">{weld_pass}</span>'),
        ("Conflicts Found", str(len(conflicts))),
        ("Clearance Required", f'{inp.get("clearance_in", 2.0)} in'),
    ] + conflict_rows)

    # Slope
    html += _section("6. Slope Report", [
        ("Slope Mode",     inp.get("slope_mode", "—")),
        ("Slope Value",    f'{inp.get("slope_value", "—")} in/ft'),
        ("Elevation Drop", slope.get("drop_fraction_str", slope.get("drop_decimal_in", "—"))),
    ])

    # Hydrotest
    html += _section("7. Hydrotest Review", [
        ("Water Weight",        f'{hydrotest.get("W_water_lbft", "—")} lb/ft'),
        ("Test Weight",         f'{hydrotest.get("W_test_lbft", "—")} lb/ft'),
        ("Load per Support",    f'{hydrotest.get("P_test_lb", "—")} lb'),
        ("Operating Load",      f'{hydrotest.get("operating_load_lb", "—")} lb'),
        ("% Increase vs Operating", f'{hydrotest.get("percent_increase", "—")} %'),
    ])

    # Turnaround
    ta = out.get("turnaround")
    if ta:
        warn_class = "warn" if ta.get("slot_travel_warning") else "pass"
        html += _section("8. Turnaround Remediation", [
            ("Shim Thickness",        ta.get("shim_fraction_str", "—")),
            ("Shim Thickness (Decimal)", f'{ta.get("shim_thickness_in", "—")} in'),
            ("Remaining Slot Travel", f'{ta.get("remaining_travel_after_shim_in", "—")} in'),
            ("Thermal Growth Allowance", f'{ta.get("thermal_growth_allowance_in", "—")} in'),
            ("Slot Travel Warning",   f'<span class="{warn_class}">{"YES — " + ta["warning_message"] if ta.get("slot_travel_warning") else "None"}</span>'),
        ])

    return html


def generate_pdf_report(calc, report_type: str = "engineering") -> str:
    """
    Generate a PDF report using WeasyPrint and save to disk.

    Args:
        calc:        Calculation ORM object with project_id, calc_id, input_json, output_json
        report_type: One of engineering|field_sheet|cut_sheet|hydrotest|turnaround

    Returns:
        Absolute path to generated PDF file.
    """
    # Import here so WeasyPrint is optional during testing
    try:
        from weasyprint import HTML, CSS as WeasyCSSClass
        weasyprint_available = True
    except ImportError:
        weasyprint_available = False

    project_dir = REPORTS_DIR / str(calc.project_id)
    project_dir.mkdir(parents=True, exist_ok=True)

    date_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = FILENAME_PATTERNS[report_type].format(
        pid=str(calc.project_id)[:8], date=date_str
    )
    file_path = str(project_dir / filename)

    # Build HTML
    if report_type == "engineering":
        body_html = _build_engineering_html(calc)
    else:
        # For other types, generate simplified version reusing engineering body
        body_html = _build_engineering_html(calc)

    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>{CSS}</style>
    </head>
    <body>
        {body_html}
    </body>
    </html>
    """

    if weasyprint_available:
        HTML(string=full_html).write_pdf(file_path)
    else:
        # Fallback: save HTML with .html extension for testing without WeasyPrint
        html_path = file_path.replace(".pdf", ".html")
        with open(html_path, "w") as f:
            f.write(full_html)
        file_path = html_path

    return file_path

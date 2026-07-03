"""PipeField OS — Pydantic Schemas"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Organization ──────────────────────────────────────────────────────────────
class OrganizationOut(BaseModel):
    org_id: str
    name: str
    created_at: datetime
    class Config:
        from_attributes = True


# ── Project ───────────────────────────────────────────────────────────────────
class ProjectOut(BaseModel):
    project_id: str
    org_id: str
    name: str
    phase: str
    created_at: datetime
    class Config:
        from_attributes = True


# ── Weld ──────────────────────────────────────────────────────────────────────
class WeldOut(BaseModel):
    weld_id: str
    project_id: str
    line_number: Optional[str]
    location_ft: Optional[float]
    drawing_number: Optional[str]
    class Config:
        from_attributes = True


# ── Spool ─────────────────────────────────────────────────────────────────────
class SpoolOut(BaseModel):
    spool_id: str
    project_id: str
    line_number: Optional[str]
    description: Optional[str]
    drawing_number: Optional[str]
    class Config:
        from_attributes = True


# ── Support Calculation Input ─────────────────────────────────────────────────
class SupportCalcInput(BaseModel):
    project_id: str
    # Pipe
    nps: str
    schedule: str
    standard: str = "B36.10M"
    material: str
    fluid: str = "water"
    insulation_thickness_in: float = 0.0
    insulation_density_lbft3: float = 5.0
    # Support
    support_type: str = "clevis_hanger"
    design_basis: str = "B31.3"
    # Slope
    slope_mode: str = "fixed"
    slope_value: float = 0.125
    slope_run_length_ft: Optional[float] = None
    # Span
    span_company_ft: Optional[float] = None
    deflection_allow_in: float = 0.10
    # Hydrotest
    hydrotest_mode: bool = False
    # Project phase
    project_phase: str = "new_construction"
    # Weld clearance
    weld_locations_ft: List[float] = []
    support_locations_ft: List[float] = []
    clearance_in: float = 2.0
    # Custom fluid
    custom_fluid_density_lbft3: Optional[float] = None
    # Turnaround extras
    existing_sag_in: Optional[float] = None
    existing_support_elevation_in: Optional[float] = None
    remaining_slot_travel_in: Optional[float] = None
    thermal_growth_in: Optional[float] = 0.0
    # Access zones
    access_zones: Optional[List[dict]] = []
    # Line info
    line_number: Optional[str] = None
    spool_id: Optional[str] = None


class CalculationOut(BaseModel):
    calc_id: str
    project_id: str
    user_id: Optional[str]
    input_json: dict
    output_json: dict
    created_at: datetime
    class Config:
        from_attributes = True


# ── Report ────────────────────────────────────────────────────────────────────
class ReportRequest(BaseModel):
    calc_id: str
    project_id: str
    report_type: str  # engineering|field_sheet|cut_sheet|hydrotest|turnaround

class ReportOut(BaseModel):
    report_id: str
    calc_id: Optional[str]
    project_id: str
    report_type: str
    file_path: str
    created_at: datetime
    class Config:
        from_attributes = True


# ── Pipe Dimensions ───────────────────────────────────────────────────────────
class PipeDimsOut(BaseModel):
    nps: str
    schedule: str
    standard: str
    OD_in: float
    wall_in: float
    ID_in: float


# ── Rod Capacity ──────────────────────────────────────────────────────────────
class RodCapacityOut(BaseModel):
    diameter_in: float
    diameter_str: str
    threads_per_inch: int
    tensile_stress_area_in2: float
    allowable_load_lb: int

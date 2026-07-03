"""Calculation Routes"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from ..models.base import get_db
from ..models.models import Calculation, SupportCalculation, AuditLog
from ..schemas.schemas import SupportCalcInput, CalculationOut
from ..calculations.pipe_support import run_full_support_calculation, calc_turnaround_remediation
from .auth import verify_token

router = APIRouter(prefix="/calculations", tags=["calculations"])


def _audit(db: Session, project_id: str, user_id: str, action: str, detail: str):
    db.add(AuditLog(
        project_id=project_id,
        user_id=user_id,
        action=action,
        detail=detail,
        timestamp=datetime.utcnow(),
    ))


@router.post("/support", response_model=CalculationOut)
def run_support_calc(
    req: SupportCalcInput,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    user_id = token["sub"]
    params = req.model_dump()

    try:
        output = run_full_support_calculation(params)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Turnaround remediation (if applicable)
    if req.project_phase == "turnaround" and req.existing_sag_in is not None:
        dims = output["dimensions"]
        ta = calc_turnaround_remediation(
            existing_sag_in=req.existing_sag_in,
            existing_support_elevation_in=req.existing_support_elevation_in or 0.0,
            remaining_slot_travel_in=req.remaining_slot_travel_in or 1.0,
            thermal_growth_in=req.thermal_growth_in or 0.0,
            span_ft=output["span"]["selected_ft"],
            W_total_lbft=output["weights"]["total_lbft"],
            material=req.material,
            OD_in=dims["OD_in"],
            ID_in=dims["ID_in"],
        )
        output["turnaround"] = ta

    # Save calculation
    calc = Calculation(
        project_id=req.project_id,
        user_id=user_id,
        input_json=params,
        output_json=output,
    )
    db.add(calc)
    db.flush()

    # Save support-specific record
    span = output["span"]
    db.add(SupportCalculation(
        calc_id=calc.calc_id,
        pipe_nps=req.nps,
        pipe_schedule=req.schedule,
        pipe_material=req.material,
        fluid_service=req.fluid,
        insulation_thickness_in=req.insulation_thickness_in,
        insulation_density_lbft3=req.insulation_density_lbft3,
        support_type=req.support_type,
        design_basis=req.design_basis,
        slope_mode=req.slope_mode,
        slope_value=req.slope_value,
        allowable_deflection_in=req.deflection_allow_in,
        span_calculated_ft=span["calculated_ft"],
        span_recommended_ft=span["recommended_ft"],
        span_company_ft=span.get("company_ft"),
        span_selected_ft=span["selected_ft"],
        hydrotest_mode=req.hydrotest_mode,
        project_phase=req.project_phase,
    ))

    # Audit — weld clearance shifts
    weld_result = output.get("weld_clearance", {})
    for entry in weld_result.get("audit_entries", []):
        _audit(db, req.project_id, user_id, "support_location_adjusted", entry)

    # Audit — calculation created
    _audit(db, req.project_id, user_id, "calculation_created",
           f"Support calc for NPS {req.nps} {req.schedule} {req.material}")

    db.commit()
    db.refresh(calc)
    return calc


@router.get("/{calc_id}", response_model=CalculationOut)
def get_calculation(
    calc_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    calc = db.query(Calculation).filter(Calculation.calc_id == calc_id).first()
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    return calc

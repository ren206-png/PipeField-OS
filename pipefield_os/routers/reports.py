"""Report Generation Routes"""

import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..models.base import get_db
from ..models.models import Calculation, Report, AuditLog
from ..schemas.schemas import ReportRequest, ReportOut
from ..outputs.pdf_generator import generate_pdf_report
from .auth import verify_token

router = APIRouter(prefix="/reports", tags=["reports"])


def _save_report(db, calc_id, project_id, report_type, file_path) -> Report:
    report = Report(
        calc_id=calc_id,
        project_id=project_id,
        report_type=report_type,
        file_path=file_path,
    )
    db.add(report)
    db.add(AuditLog(
        project_id=project_id,
        action="report_generated",
        detail=f"{report_type} report generated: {os.path.basename(file_path)}",
        timestamp=datetime.utcnow(),
    ))
    db.commit()
    db.refresh(report)
    return report


@router.post("/pdf", response_model=ReportOut)
def generate_engineering_report(
    req: ReportRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    calc = db.query(Calculation).filter(Calculation.calc_id == req.calc_id).first()
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    path = generate_pdf_report(calc, report_type="engineering")
    return _save_report(db, req.calc_id, req.project_id, "engineering", path)


@router.post("/field-sheet", response_model=ReportOut)
def generate_field_sheet(
    req: ReportRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    calc = db.query(Calculation).filter(Calculation.calc_id == req.calc_id).first()
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    path = generate_pdf_report(calc, report_type="field_sheet")
    return _save_report(db, req.calc_id, req.project_id, "field_sheet", path)


@router.post("/cut-sheet", response_model=ReportOut)
def generate_cut_sheet(
    req: ReportRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    calc = db.query(Calculation).filter(Calculation.calc_id == req.calc_id).first()
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    path = generate_pdf_report(calc, report_type="cut_sheet")
    return _save_report(db, req.calc_id, req.project_id, "cut_sheet", path)


@router.post("/hydrotest", response_model=ReportOut)
def generate_hydrotest_report(
    req: ReportRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    calc = db.query(Calculation).filter(Calculation.calc_id == req.calc_id).first()
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    path = generate_pdf_report(calc, report_type="hydrotest")
    return _save_report(db, req.calc_id, req.project_id, "hydrotest", path)


@router.post("/turnaround", response_model=ReportOut)
def generate_turnaround_report(
    req: ReportRequest,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    calc = db.query(Calculation).filter(Calculation.calc_id == req.calc_id).first()
    if not calc:
        raise HTTPException(status_code=404, detail="Calculation not found")
    path = generate_pdf_report(calc, report_type="turnaround")
    return _save_report(db, req.calc_id, req.project_id, "turnaround", path)

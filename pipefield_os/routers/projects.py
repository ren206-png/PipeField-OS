"""Project, Weld, Spool, and Report Routes"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..models.base import get_db
from ..models.models import Project, Weld, Spool, Calculation, Report
from ..schemas.schemas import ProjectOut, WeldOut, SpoolOut, CalculationOut, ReportOut
from .auth import verify_token

router = APIRouter(tags=["projects"])


@router.get("/organizations/{org_id}/projects", response_model=List[ProjectOut])
def list_projects(
    org_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    return db.query(Project).filter(Project.org_id == org_id).all()


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    p = db.query(Project).filter(Project.project_id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.get("/projects/{project_id}/welds", response_model=List[WeldOut])
def list_welds(
    project_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    return db.query(Weld).filter(Weld.project_id == project_id).all()


@router.get("/projects/{project_id}/spools", response_model=List[SpoolOut])
def list_spools(
    project_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    return db.query(Spool).filter(Spool.project_id == project_id).all()


@router.get("/projects/{project_id}/calculations", response_model=List[CalculationOut])
def list_calculations(
    project_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    return db.query(Calculation).filter(Calculation.project_id == project_id).all()


@router.get("/projects/{project_id}/reports", response_model=List[ReportOut])
def list_reports(
    project_id: str,
    db: Session = Depends(get_db),
    token: dict = Depends(verify_token),
):
    return db.query(Report).filter(Report.project_id == project_id).all()

"""
PipeField OS — SQLAlchemy Database Models
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Boolean, Integer, DateTime,
    ForeignKey, JSON, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from .base import Base


def _uuid():
    return str(uuid.uuid4())


class Organization(Base):
    __tablename__ = "organizations"
    org_id    = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    name      = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    users    = relationship("User", back_populates="organization")
    projects = relationship("Project", back_populates="organization")


class User(Base):
    __tablename__ = "users"
    user_id       = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id        = Column(UUID(as_uuid=False), ForeignKey("organizations.org_id"))
    name          = Column(String(255), nullable=False)
    email         = Column(String(255), unique=True, nullable=False)
    role          = Column(String(50), default="engineer")
    password_hash = Column(String(255), nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)

    organization  = relationship("Organization", back_populates="users")
    calculations  = relationship("Calculation", back_populates="user")


class Project(Base):
    __tablename__ = "projects"
    project_id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    org_id     = Column(UUID(as_uuid=False), ForeignKey("organizations.org_id"))
    name       = Column(String(255), nullable=False)
    phase      = Column(String(50), default="new_construction")  # new_construction | turnaround
    created_at = Column(DateTime, default=datetime.utcnow)

    organization   = relationship("Organization", back_populates="projects")
    welds          = relationship("Weld", back_populates="project")
    spools         = relationship("Spool", back_populates="project")
    calculations   = relationship("Calculation", back_populates="project")
    reports        = relationship("Report", back_populates="project")
    audit_logs     = relationship("AuditLog", back_populates="project")


class Weld(Base):
    __tablename__ = "welds"
    weld_id        = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id     = Column(UUID(as_uuid=False), ForeignKey("projects.project_id"))
    spool_id       = Column(UUID(as_uuid=False), ForeignKey("spools.spool_id"), nullable=True)
    line_number    = Column(String(100))
    location_ft    = Column(Float)
    drawing_number = Column(String(100))

    project = relationship("Project", back_populates="welds")
    spool   = relationship("Spool", back_populates="welds")


class Spool(Base):
    __tablename__ = "spools"
    spool_id       = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id     = Column(UUID(as_uuid=False), ForeignKey("projects.project_id"))
    line_number    = Column(String(100))
    description    = Column(Text)
    drawing_number = Column(String(100))

    project = relationship("Project", back_populates="spools")
    welds   = relationship("Weld", back_populates="spool")


class Calculation(Base):
    __tablename__ = "calculations"
    calc_id    = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.project_id"))
    user_id    = Column(UUID(as_uuid=False), ForeignKey("users.user_id"))
    input_json = Column(JSON)
    output_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    project             = relationship("Project", back_populates="calculations")
    user                = relationship("User", back_populates="calculations")
    support_calculation = relationship("SupportCalculation", back_populates="calculation", uselist=False)
    reports             = relationship("Report", back_populates="calculation")


class SupportCalculation(Base):
    __tablename__ = "support_calculations"
    id                    = Column(Integer, primary_key=True, autoincrement=True)
    calc_id               = Column(UUID(as_uuid=False), ForeignKey("calculations.calc_id"))
    pipe_nps              = Column(String(10))
    pipe_schedule         = Column(String(20))
    pipe_material         = Column(String(50))
    fluid_service         = Column(String(50))
    insulation_thickness_in    = Column(Float, default=0.0)
    insulation_density_lbft3   = Column(Float, default=5.0)
    support_type          = Column(String(50))
    design_basis          = Column(String(10))  # B31.1 or B31.3
    slope_mode            = Column(String(20))
    slope_value           = Column(Float)
    allowable_deflection_in    = Column(Float, default=0.10)
    span_calculated_ft    = Column(Float)
    span_recommended_ft   = Column(Float)
    span_company_ft       = Column(Float)
    span_selected_ft      = Column(Float)
    hydrotest_mode        = Column(Boolean, default=False)
    project_phase         = Column(String(30))  # new_construction | turnaround

    calculation = relationship("Calculation", back_populates="support_calculation")


class Report(Base):
    __tablename__ = "reports"
    report_id   = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    calc_id     = Column(UUID(as_uuid=False), ForeignKey("calculations.calc_id"))
    project_id  = Column(UUID(as_uuid=False), ForeignKey("projects.project_id"))
    report_type = Column(String(50))  # engineering|field_sheet|cut_sheet|hydrotest|turnaround
    file_path   = Column(String(500))
    created_at  = Column(DateTime, default=datetime.utcnow)

    calculation = relationship("Calculation", back_populates="reports")
    project     = relationship("Project", back_populates="reports")


class AuditLog(Base):
    __tablename__ = "audit_log"
    log_id     = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.project_id"))
    user_id    = Column(UUID(as_uuid=False), nullable=True)
    action     = Column(String(100))
    detail     = Column(Text)
    timestamp  = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="audit_logs")

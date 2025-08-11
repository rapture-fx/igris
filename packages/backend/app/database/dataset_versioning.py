from sqlalchemy import Column, DateTime, String, Enum, ForeignKey, Float, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.database.connection import Base
from app.database.models import User, Workspace  # reuse existing tables

class DatasetStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"))
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    status = Column(Enum(DatasetStatus), default=DatasetStatus.ACTIVE)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    workspace = relationship(Workspace, backref="datasets")
    created_by = relationship(User, backref="datasets")
    versions = relationship("DatasetVersion", back_populates="dataset")

class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"))
    version = Column(Float, nullable=False)
    source_artifact_path = Column(String)  # path in S3/GCS or internal storage
    transformation_spec = Column(JSON, default={})
    row_count = Column(Float)
    column_schema = Column(JSON, default={})

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    dataset = relationship("Dataset", back_populates="versions") 
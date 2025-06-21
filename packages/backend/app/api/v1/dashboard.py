from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime

router = APIRouter()

# Pydantic models
class TeamMemberCreate(BaseModel):
    email: str
    role: str

class TeamMember(BaseModel):
    id: str
    email: str
    role: str
    status: str
    last_active: str

class InviteRequest(BaseModel):
    email: str
    role: str

# Mock data for demonstration
mock_team_members = [
    {
        "id": "1",
        "email": "admin@example.com",
        "role": "admin",
        "status": "active",
        "last_active": datetime.now().isoformat()
    },
    {
        "id": "2", 
        "email": "user@example.com",
        "role": "member",
        "status": "active",
        "last_active": datetime.now().isoformat()
    }
]

@router.get("/team", response_model=List[TeamMember])
async def get_team_members():
    """Get all team members"""
    return mock_team_members

@router.post("/team/invite")
async def invite_team_member(request: InviteRequest):
    """Invite a new team member"""
    # In a real implementation, this would send an email invitation
    new_member = {
        "id": str(uuid.uuid4()),
        "email": request.email,
        "role": request.role,
        "status": "pending",
        "last_active": datetime.now().isoformat()
    }
    mock_team_members.append(new_member)
    return {"message": "Invitation sent successfully", "member": new_member}

@router.delete("/team/{member_id}")
async def remove_team_member(member_id: str):
    """Remove a team member"""
    global mock_team_members
    mock_team_members = [m for m in mock_team_members if m["id"] != member_id]
    return {"message": "Team member removed successfully"} 
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime

router = APIRouter()

# Pydantic models
class PartnerProgram(BaseModel):
    id: str
    name: str
    description: str
    benefits: List[str]
    requirements: List[str]

class PartnerApplication(BaseModel):
    company_name: str
    website: str
    description: str
    use_case: str

# Mock data for demonstration
mock_partner_programs = [
    {
        "id": "1",
        "name": "Technology Partner Program",
        "description": "Partner with us to integrate your technology solutions",
        "benefits": [
            "Revenue sharing up to 30%",
            "Marketing co-promotion",
            "Technical support",
            "Priority feature requests"
        ],
        "requirements": [
            "Proven track record in data technology",
            "Minimum 1000 active users",
            "API integration capability",
            "Dedicated technical contact"
        ]
    },
    {
        "id": "2",
        "name": "Solution Provider Program",
        "description": "Become a certified solution provider for our platform",
        "benefits": [
            "Certification and badging",
            "Lead generation support",
            "Training and enablement",
            "Partner portal access"
        ],
        "requirements": [
            "Experience in data consulting",
            "Certified team members",
            "Case studies and references",
            "Service level commitments"
        ]
    },
    {
        "id": "3",
        "name": "Academic Partner Program",
        "description": "Collaborate with educational institutions for research",
        "benefits": [
            "Free platform access for research",
            "Data for academic studies",
            "Publication opportunities",
            "Student internship programs"
        ],
        "requirements": [
            "Accredited educational institution",
            "Research focus on data science",
            "Ethics committee approval",
            "Publication commitment"
        ]
    }
]

@router.get("/programs", response_model=List[PartnerProgram])
async def get_partner_programs():
    """Get all partner programs"""
    return mock_partner_programs

@router.post("/applications")
async def apply_for_partner_program(application: PartnerApplication):
    """Submit a partner program application"""
    new_application = {
        "id": str(uuid.uuid4()),
        "company_name": application.company_name,
        "website": application.website,
        "description": application.description,
        "use_case": application.use_case,
        "status": "pending_review",
        "submitted_at": datetime.now().isoformat()
    }
    
    return {
        "message": "Partner application submitted successfully",
        "application_id": new_application["id"],
        "status": "pending_review",
        "next_steps": [
            "Our team will review your application within 5 business days",
            "You will receive an email with the review outcome",
            "If approved, we'll schedule an onboarding call"
        ]
    } 
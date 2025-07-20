from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime

router = APIRouter()

# Pydantic models
class CodeSample(BaseModel):
    id: str
    title: str
    description: str
    code: str
    language: str
    category: str
    author: str
    likes: int
    created_at: str

class CodeSampleSubmission(BaseModel):
    title: str
    description: str
    code: str
    language: str
    category: str

class Challenge(BaseModel):
    id: str
    title: str
    description: str
    prize: str
    deadline: str
    participants: int
    status: str

# Mock data for demonstration
mock_code_samples = [
    {
        "id": "1",
        "title": "Data Cleaning with Pandas",
        "description": "Example of cleaning messy CSV data",
        "code": """import pandas as pd\n\n# Clean data\ndf = pd.read_csv('data.csv')\ndf.dropna(inplace=True)\ndf['column'] = df['column'].str.strip()""",
        "language": "python",
        "category": "data_cleaning",
        "author": "john_doe",
        "likes": 15,
        "created_at": datetime.now().isoformat()
    },
    {
        "id": "2",
        "title": "Email Validation Function",
        "description": "Simple email validation using regex",
        "code": """import re\n\ndef validate_email(email):\n    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'\n    return re.match(pattern, email) is not None""",
        "language": "python",
        "category": "validation",
        "author": "jane_smith",
        "likes": 8,
        "created_at": datetime.now().isoformat()
    }
]

mock_challenges = [
    {
        "id": "1",
        "title": "Clean 1M Records Challenge",
        "description": "Optimize data cleaning for large datasets",
        "prize": "$500",
        "deadline": "2024-02-29",
        "participants": 42,
        "status": "active"
    },
    {
        "id": "2",
        "title": "Best Data Visualization",
        "description": "Create the most insightful data visualization",
        "prize": "$300",
        "deadline": "2024-03-15",
        "participants": 28,
        "status": "upcoming"
    }
]

@router.get("/code-samples", response_model=List[CodeSample])
async def get_code_samples():
    """Get all code samples"""
    return mock_code_samples

@router.post("/code-samples")
async def submit_code_sample(sample: CodeSampleSubmission):
    """Submit a new code sample"""
    new_sample = {
        "id": str(uuid.uuid4()),
        "title": sample.title,
        "description": sample.description,
        "code": sample.code,
        "language": sample.language,
        "category": sample.category,
        "author": "current_user",  # In real app, get from auth
        "likes": 0,
        "created_at": datetime.now().isoformat()
    }
    mock_code_samples.append(new_sample)
    return {"message": "Code sample submitted successfully", "sample": new_sample}

@router.get("/challenges", response_model=List[Challenge])
async def get_challenges():
    """Get all challenges"""
    return mock_challenges

@router.post("/challenges/{challenge_id}/participate")
async def participate_in_challenge(challenge_id: str):
    """Participate in a challenge"""
    challenge = next((c for c in mock_challenges if c["id"] == challenge_id), None)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    challenge["participants"] += 1
    return {"message": "Successfully joined the challenge"} 
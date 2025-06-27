#!/bin/bash

# Pollarbase Development Deployment
# Quick local setup without Docker

set -e

echo "🚀 Starting Pollarbase Development Deployment"
echo "============================================="

# Check Python
echo "🐍 Checking Python environment..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

echo "✅ Python found: $(python3 --version)"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install core dependencies
echo "📥 Installing core dependencies..."
pip install --upgrade pip
pip install -r requirements-core.txt

# Create logs directory
mkdir -p logs

# Set up environment variables
echo "🔧 Setting up environment..."
export DATABASE_URL="sqlite:///./pollarbase_dev.db"
export REDIS_URL="redis://localhost:6379/0"
export ML_SERVICE_URL="http://localhost:8001"
export USE_REMOTE_ML_SERVICE="false"
export SECRET_KEY="dev-secret-key-change-in-production"
export JWT_SECRET_KEY="dev-jwt-secret-key"
export ENVIRONMENT="development"
export DEBUG="true"

# Create development database
echo "🗄️  Setting up development database..."
if [ ! -f "pollarbase_dev.db" ]; then
    python3 -c "
import sqlite3
conn = sqlite3.connect('pollarbase_dev.db')
conn.execute('''CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)''')
conn.execute('''CREATE TABLE IF NOT EXISTS investigations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    filename TEXT,
    status TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    quality_score REAL,
    insights TEXT
)''')
conn.commit()
conn.close()
print('✅ Development database created')
"
fi

# Start the development server
echo "🌟 Starting Pollarbase Development Server..."
echo ""
echo "🎯 Development Mode Configuration:"
echo "   Database: SQLite (local file)"
echo "   ML Service: Integrated (no separate service)"
echo "   Environment: Development"
echo "   Debug: Enabled"
echo ""
echo "🌐 Server will be available at:"
echo "   API: http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
echo "   Health: http://localhost:8000/health"
echo ""
echo "🔧 To stop the server, press Ctrl+C"
echo "📊 Access logs will be shown below..."
echo ""

# Start with hot reload
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 
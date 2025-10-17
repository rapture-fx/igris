#!/bin/bash
# Test runner script for Python ML Service

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Python ML Service - Test Runner${NC}"
echo -e "${GREEN}==================================${NC}"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pip install -q -r requirements.txt
pip install -q -r requirements-test.txt

# Generate proto files if needed
if [ ! -f "proto/ml_service_pb2.py" ]; then
    echo -e "${YELLOW}Generating proto files...${NC}"
    ./generate_proto.sh
fi

# Parse command line arguments
TEST_TYPE="${1:-all}"
COVERAGE_FORMAT="${2:-term}"

echo -e "${GREEN}Running tests: ${TEST_TYPE}${NC}"

case "$TEST_TYPE" in
    "unit")
        pytest -v -m unit --cov=service --cov=orchestration --cov-report=$COVERAGE_FORMAT
        ;;
    "integration")
        pytest -v -m integration --cov=service --cov=orchestration --cov-report=$COVERAGE_FORMAT
        ;;
    "performance")
        pytest -v -m performance --benchmark-only
        ;;
    "fast")
        pytest -v -m "not slow" --cov=service --cov=orchestration --cov-report=$COVERAGE_FORMAT
        ;;
    "all")
        pytest -v --cov=service --cov=orchestration --cov-report=$COVERAGE_FORMAT --cov-report=html
        ;;
    "coverage")
        pytest --cov=service --cov=orchestration --cov-report=term-missing --cov-report=html --cov-report=xml
        echo -e "${GREEN}Coverage report generated in htmlcov/index.html${NC}"
        ;;
    *)
        echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
        echo "Usage: ./run_tests.sh [unit|integration|performance|fast|all|coverage]"
        exit 1
        ;;
esac

TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}==================================${NC}"
    echo -e "${GREEN}Tests completed successfully!${NC}"
    echo -e "${GREEN}==================================${NC}"
else
    echo -e "${RED}==================================${NC}"
    echo -e "${RED}Tests failed with exit code: $TEST_EXIT_CODE${NC}"
    echo -e "${RED}==================================${NC}"
fi

exit $TEST_EXIT_CODE

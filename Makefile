# Schlep Engine Monorepo Testing Commands

.PHONY: help test test-api test-rl install-test clean

help: ## Show available commands
	@echo "Schlep Engine Testing Commands:"
	@echo "  test        - Run all tests with proper monorepo setup"
	@echo "  test-api    - Run API tests only"  
	@echo "  test-rl     - Run RL optimization tests only"
	@echo "  install-test - Install test dependencies"
	@echo "  clean       - Clean test artifacts"

# Install test dependencies
install-test: ## Install testing dependencies
	@echo "Installing test dependencies..."
	pip install pytest pytest-asyncio pytest-cov pytest-mock python-dotenv
	@echo "Test dependencies installed!"

# Main test command with proper monorepo setup
test: ## Run all tests across the monorepo
	@echo "Running tests for Schlep Engine monorepo..."
	@echo "Setting up Python paths and environment..."
	PYTHONPATH="apps/api:packages/cli/src:packages/python-sdk/src:." python -m pytest -v --tb=short

# API-specific tests
test-api: ## Run API tests only
	@echo "Running API tests..."
	PYTHONPATH="apps/api:packages/cli/src:packages/python-sdk/src:." python -m pytest apps/api/tests/ -v

# RL-specific tests  
test-rl: ## Run RL optimization tests only
	@echo "Running RL optimization tests..."
	PYTHONPATH="apps/api:packages/cli/src:packages/python-sdk/src:." python -m pytest -m rl -v

# Fast tests (exclude slow integration tests)
test-fast: ## Run fast tests only
	@echo "Running fast tests..."
	PYTHONPATH="apps/api:packages/cli/src:packages/python-sdk/src:." python -m pytest -m "not slow" -v

# Test with coverage
test-coverage: ## Run tests with coverage report
	@echo "Running tests with coverage..."
	PYTHONPATH="apps/api:packages/cli/src:packages/python-sdk/src:." python -m pytest --cov=app --cov=packages --cov-report=html --cov-report=term-missing

# Clean test artifacts
clean: ## Clean up test artifacts
	@echo "Cleaning test artifacts..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name ".pytest_cache" -exec rm -rf {} + || true
	rm -rf coverage_html .coverage test_checkpoints test_logs test_uploads
	@echo "Cleanup completed!"

# Setup environment for testing
setup-test-env: ## Setup test environment
	@echo "Setting up test environment..."
	cp .env.test .env || echo "Using existing .env file"
	mkdir -p test_checkpoints test_logs test_uploads
	@echo "Test environment ready!"

# Run basic RL system test
test-rl-basic: ## Run basic RL system test
	@echo "Running basic RL system test..."
	cd apps/api && PYTHONPATH="." python test_rl_basic.py
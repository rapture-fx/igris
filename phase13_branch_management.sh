#!/bin/bash
# Phase 13 Parallel Branch Management Script
# This script creates three parallel branches for Phase 13 development
# based on the latest development branch (fix/ci-architecture-alignment)

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_BRANCH="fix/ci-architecture-alignment"
BRANCH_PREFIX="phase13"
BRANCHES=("${BRANCH_PREFIX}-agent1" "${BRANCH_PREFIX}-agent2" "${BRANCH_PREFIX}-agent3")

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository!"
        exit 1
    fi
    print_success "Git repository detected"
}

# Function to check if base branch exists
check_base_branch() {
    if ! git rev-parse --verify "$BASE_BRANCH" > /dev/null 2>&1; then
        print_error "Base branch '$BASE_BRANCH' does not exist!"
        exit 1
    fi
    print_success "Base branch '$BASE_BRANCH' exists"
}

# Function to update base branch
update_base_branch() {
    print_info "Fetching latest changes from origin..."
    git fetch origin

    print_info "Checking out base branch: $BASE_BRANCH"
    git checkout "$BASE_BRANCH"

    # Check if branch tracks a remote
    if git rev-parse --abbrev-ref "$BASE_BRANCH@{upstream}" > /dev/null 2>&1; then
        print_info "Pulling latest changes for $BASE_BRANCH..."
        git pull origin "$BASE_BRANCH"
        print_success "Base branch updated"
    else
        print_warning "Base branch does not track a remote. Using local version."
    fi
}

# Function to create a new branch
create_branch() {
    local branch_name=$1

    print_info "Creating branch: $branch_name from $BASE_BRANCH"

    # Check if branch already exists locally
    if git rev-parse --verify "$branch_name" > /dev/null 2>&1; then
        print_warning "Branch '$branch_name' already exists locally"
        read -p "Do you want to delete and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git branch -D "$branch_name"
            print_success "Deleted existing branch '$branch_name'"
        else
            print_warning "Skipping creation of '$branch_name'"
            return
        fi
    fi

    # Create the branch
    git checkout -b "$branch_name" "$BASE_BRANCH"
    print_success "Created branch: $branch_name"

    # Push to remote
    print_info "Pushing $branch_name to origin..."
    git push -u origin "$branch_name"
    print_success "Pushed $branch_name to origin"

    # Return to base branch
    git checkout "$BASE_BRANCH"
}

# Function to generate branch status report
generate_status_report() {
    print_info "Generating branch status report..."

    echo ""
    echo "=================================="
    echo "Phase 13 Branch Status Report"
    echo "=================================="
    echo ""
    echo "Base Branch: $BASE_BRANCH"
    echo "Base Branch Commit: $(git rev-parse --short $BASE_BRANCH)"
    echo ""
    echo "Created Branches:"
    echo ""

    for branch in "${BRANCHES[@]}"; do
        if git rev-parse --verify "$branch" > /dev/null 2>&1; then
            local commit=$(git rev-parse --short "$branch")
            local remote_status=""

            if git ls-remote --heads origin "$branch" | grep -q "$branch"; then
                remote_status="✓ Pushed to origin"
            else
                remote_status="✗ Not pushed to origin"
            fi

            echo "  - $branch"
            echo "    Commit: $commit"
            echo "    Remote: $remote_status"
            echo ""
        else
            echo "  - $branch: NOT CREATED"
            echo ""
        fi
    done

    echo "=================================="
}

# Main execution
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║   Phase 13 Parallel Branch Creation Script            ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""

    # Pre-flight checks
    check_git_repo
    check_base_branch

    # Update base branch
    print_info "Step 1: Updating base branch"
    update_base_branch
    echo ""

    # Create branches
    print_info "Step 2: Creating parallel branches"
    for branch in "${BRANCHES[@]}"; do
        create_branch "$branch"
        echo ""
    done

    # Generate report
    print_info "Step 3: Generating status report"
    generate_status_report

    print_success "All branches created successfully!"
    print_info "Next steps:"
    echo "  1. Review the PHASE13_BRANCH_MANAGEMENT_GUIDE.md for merge strategies"
    echo "  2. Use the conflict detection script to check for potential conflicts"
    echo "  3. Begin development on individual branches"
    echo ""
}

# Run main function
main

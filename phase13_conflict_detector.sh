#!/bin/bash
# Phase 13 Conflict Detection and Merge Simulation Script
# This script simulates merges and detects potential conflicts

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
BASE_BRANCH="fix/ci-architecture-alignment"
BRANCHES=("phase13-agent1" "phase13-agent2" "phase13-agent3")
REPORT_FILE="phase13_conflict_report.json"
MARKDOWN_REPORT="phase13_conflict_report.md"

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

print_header() {
    echo -e "${MAGENTA}$1${NC}"
}

# Initialize JSON report
initialize_json_report() {
    cat > "$REPORT_FILE" << 'EOF'
{
  "report_date": "",
  "base_branch": "",
  "branches_analyzed": [],
  "merge_simulations": []
}
EOF
    print_success "Initialized JSON report: $REPORT_FILE"
}

# Update JSON field
update_json_field() {
    local field=$1
    local value=$2
    local temp_file="${REPORT_FILE}.tmp"

    jq "$field = \"$value\"" "$REPORT_FILE" > "$temp_file" && mv "$temp_file" "$REPORT_FILE"
}

# Add branch to analyzed list
add_branch_to_json() {
    local branch=$1
    local temp_file="${REPORT_FILE}.tmp"

    jq ".branches_analyzed += [\"$branch\"]" "$REPORT_FILE" > "$temp_file" && mv "$temp_file" "$REPORT_FILE"
}

# Detect files changed in a branch compared to base
detect_changed_files() {
    local branch=$1
    local base=$2

    print_info "Analyzing changed files in $branch compared to $base"

    # Get list of changed files
    local changed_files=$(git diff --name-only "$base...$branch" 2>/dev/null || echo "")

    if [ -z "$changed_files" ]; then
        print_warning "No changes detected in $branch"
        echo "0"
        return
    fi

    local file_count=$(echo "$changed_files" | wc -l | tr -d ' ')
    print_info "Found $file_count changed file(s) in $branch"

    echo "$file_count"
}

# Simulate merge and detect conflicts
simulate_merge() {
    local source_branch=$1
    local target_branch=$2
    local simulation_id="sim_${source_branch}_to_${target_branch}_$(date +%s)"

    print_header "\n=========================================="
    print_header "Merge Simulation: $source_branch → $target_branch"
    print_header "=========================================="

    # Create temporary branch for simulation
    local temp_branch="temp_merge_sim_$$"

    # Ensure we're on the target branch
    git checkout "$target_branch" 2>/dev/null || {
        print_error "Failed to checkout $target_branch"
        return 1
    }

    # Create temporary branch
    git checkout -b "$temp_branch" "$target_branch" 2>/dev/null

    # Attempt merge
    print_info "Attempting merge of $source_branch into $temp_branch..."

    local merge_status=0
    local conflict_files=""
    local merge_output=""

    merge_output=$(git merge --no-commit --no-ff "$source_branch" 2>&1) || merge_status=$?

    if [ $merge_status -eq 0 ]; then
        print_success "✓ Merge successful - NO CONFLICTS"

        # Get merge stats
        local files_changed=$(git diff --cached --name-only | wc -l | tr -d ' ')
        local insertions=$(git diff --cached --numstat | awk '{sum += $1} END {print sum}')
        local deletions=$(git diff --cached --numstat | awk '{sum += $2} END {print sum}')

        echo ""
        print_info "Merge Statistics:"
        echo "  Files changed: $files_changed"
        echo "  Insertions: ${insertions:-0}"
        echo "  Deletions: ${deletions:-0}"

        # Abort the merge
        git merge --abort 2>/dev/null || git reset --hard HEAD 2>/dev/null

        # Add to JSON report
        add_merge_simulation_to_json "$source_branch" "$target_branch" "success" "0" ""

    else
        print_error "✗ Merge has CONFLICTS"

        # Get conflicting files
        conflict_files=$(git diff --name-only --diff-filter=U 2>/dev/null || echo "")

        if [ -n "$conflict_files" ]; then
            local conflict_count=$(echo "$conflict_files" | wc -l | tr -d ' ')
            print_error "Conflicting files ($conflict_count):"
            echo "$conflict_files" | while read -r file; do
                echo -e "  ${RED}✗${NC} $file"
            done
        fi

        # Abort the merge
        git merge --abort 2>/dev/null || git reset --hard HEAD 2>/dev/null

        # Add to JSON report
        add_merge_simulation_to_json "$source_branch" "$target_branch" "conflict" "$conflict_count" "$conflict_files"
    fi

    # Clean up temporary branch
    git checkout "$target_branch" 2>/dev/null
    git branch -D "$temp_branch" 2>/dev/null

    echo ""
}

# Add merge simulation result to JSON
add_merge_simulation_to_json() {
    local source=$1
    local target=$2
    local status=$3
    local conflict_count=$4
    local conflict_files=$5

    local temp_file="${REPORT_FILE}.tmp"

    # Convert conflict files to JSON array
    local files_json="[]"
    if [ -n "$conflict_files" ]; then
        files_json=$(echo "$conflict_files" | jq -R -s -c 'split("\n") | map(select(length > 0))')
    fi

    local simulation_json=$(cat <<EOF
{
  "source_branch": "$source",
  "target_branch": "$target",
  "status": "$status",
  "conflict_count": $conflict_count,
  "conflicting_files": $files_json,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    )

    jq ".merge_simulations += [$simulation_json]" "$REPORT_FILE" > "$temp_file" && mv "$temp_file" "$REPORT_FILE"
}

# Detect potential conflicts between parallel branches
detect_parallel_conflicts() {
    print_header "\n=========================================="
    print_header "Parallel Branch Conflict Detection"
    print_header "=========================================="

    local branches_to_check=("${BRANCHES[@]}")

    for i in "${!branches_to_check[@]}"; do
        for j in "${!branches_to_check[@]}"; do
            if [ $i -lt $j ]; then
                local branch1="${branches_to_check[$i]}"
                local branch2="${branches_to_check[$j]}"

                print_info "\nChecking for overlapping changes: $branch1 vs $branch2"

                # Get files changed in both branches
                local files1=$(git diff --name-only "$BASE_BRANCH...$branch1" 2>/dev/null | sort)
                local files2=$(git diff --name-only "$BASE_BRANCH...$branch2" 2>/dev/null | sort)

                # Find common files
                local common_files=$(comm -12 <(echo "$files1") <(echo "$files2"))

                if [ -z "$common_files" ]; then
                    print_success "✓ No overlapping file changes detected"
                else
                    local common_count=$(echo "$common_files" | wc -l | tr -d ' ')
                    print_warning "⚠ Found $common_count file(s) modified in both branches:"
                    echo "$common_files" | while read -r file; do
                        echo -e "  ${YELLOW}!${NC} $file"
                    done
                fi
            fi
        done
    done

    echo ""
}

# Generate markdown report
generate_markdown_report() {
    print_info "Generating markdown report: $MARKDOWN_REPORT"

    local report_date=$(jq -r '.report_date' "$REPORT_FILE")
    local base_branch=$(jq -r '.base_branch' "$REPORT_FILE")

    cat > "$MARKDOWN_REPORT" << EOF
# Phase 13 Conflict Detection Report

**Generated:** $report_date
**Base Branch:** \`$base_branch\`

---

## Executive Summary

This report provides a comprehensive analysis of potential merge conflicts for Phase 13 parallel development branches.

### Branches Analyzed

EOF

    # Add branches
    jq -r '.branches_analyzed[]' "$REPORT_FILE" | while read -r branch; do
        echo "- \`$branch\`" >> "$MARKDOWN_REPORT"
    done

    cat >> "$MARKDOWN_REPORT" << EOF

---

## Merge Simulation Results

EOF

    # Add merge simulations
    local sim_count=$(jq '.merge_simulations | length' "$REPORT_FILE")

    for ((i=0; i<sim_count; i++)); do
        local source=$(jq -r ".merge_simulations[$i].source_branch" "$REPORT_FILE")
        local target=$(jq -r ".merge_simulations[$i].target_branch" "$REPORT_FILE")
        local status=$(jq -r ".merge_simulations[$i].status" "$REPORT_FILE")
        local conflict_count=$(jq -r ".merge_simulations[$i].conflict_count" "$REPORT_FILE")
        local timestamp=$(jq -r ".merge_simulations[$i].timestamp" "$REPORT_FILE")

        cat >> "$MARKDOWN_REPORT" << EOF
### Simulation $((i+1)): \`$source\` → \`$target\`

- **Status:** $([ "$status" == "success" ] && echo "✅ SUCCESS" || echo "❌ CONFLICTS DETECTED")
- **Timestamp:** $timestamp
EOF

        if [ "$status" == "conflict" ]; then
            cat >> "$MARKDOWN_REPORT" << EOF
- **Conflict Count:** $conflict_count

**Conflicting Files:**

EOF
            jq -r ".merge_simulations[$i].conflicting_files[]" "$REPORT_FILE" | while read -r file; do
                echo "- \`$file\`" >> "$MARKDOWN_REPORT"
            done
        fi

        echo "" >> "$MARKDOWN_REPORT"
    done

    cat >> "$MARKDOWN_REPORT" << EOF

---

## Recommended Merge Strategy

Based on the simulation results:

1. **For branches with NO conflicts:**
   - Use standard merge with \`--no-ff\` to preserve history
   - Command: \`git merge --no-ff <branch-name>\`

2. **For branches with conflicts:**
   - Review conflicting files carefully
   - Consider using a three-way merge tool (\`git mergetool\`)
   - Resolve conflicts manually
   - Test thoroughly after resolution

3. **General best practices:**
   - Always create a backup branch before merging
   - Run full test suite after merge
   - Use pull requests for code review
   - Rebase if linear history is preferred

---

## Next Steps

1. Review this report and the JSON data in \`$REPORT_FILE\`
2. Coordinate with team members working on conflicting files
3. Plan merge order to minimize conflicts
4. Use the merge preparation script for safe merging

EOF

    print_success "Markdown report generated: $MARKDOWN_REPORT"
}

# Main execution
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║   Phase 13 Conflict Detection & Merge Simulation      ║"
    echo "╚════════════════════════════════════════════════════════╝"
    echo ""

    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed. Please install jq to use this script."
        print_info "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
        exit 1
    fi

    # Initialize report
    initialize_json_report
    update_json_field '.report_date' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    update_json_field '.base_branch' "$BASE_BRANCH"

    # Ensure we have the latest changes
    print_info "Fetching latest changes from origin..."
    git fetch origin

    # Analyze each branch
    print_header "\nStep 1: Analyzing Branch Changes"
    for branch in "${BRANCHES[@]}"; do
        if git rev-parse --verify "$branch" > /dev/null 2>&1; then
            add_branch_to_json "$branch"
            detect_changed_files "$branch" "$BASE_BRANCH"
        else
            print_warning "Branch $branch does not exist - skipping"
        fi
    done

    # Run merge simulations
    print_header "\nStep 2: Running Merge Simulations"
    for branch in "${BRANCHES[@]}"; do
        if git rev-parse --verify "$branch" > /dev/null 2>&1; then
            simulate_merge "$branch" "$BASE_BRANCH"
        fi
    done

    # Detect parallel conflicts
    print_header "\nStep 3: Detecting Parallel Branch Conflicts"
    detect_parallel_conflicts

    # Generate reports
    print_header "\nStep 4: Generating Reports"
    generate_markdown_report

    print_success "\nConflict detection complete!"
    print_info "Reports generated:"
    echo "  - JSON: $REPORT_FILE"
    echo "  - Markdown: $MARKDOWN_REPORT"
    echo ""
}

main

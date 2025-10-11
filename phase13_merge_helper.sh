#!/bin/bash
# Phase 13 Merge Helper Script
# Provides safe merge commands and best practices

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
BASE_BRANCH="fix/ci-architecture-alignment"
BRANCHES=("phase13-agent1" "phase13-agent2" "phase13-agent3")

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
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════${NC}"
}

print_command() {
    echo -e "${CYAN}$ $1${NC}"
}

# Show merge strategy options
show_merge_strategies() {
    print_header "Merge Strategy Guide"
    echo ""

    cat << 'EOF'
There are three main merge strategies:

1. MERGE (--no-ff)
   - Preserves complete branch history
   - Creates a merge commit
   - Best for: Feature branches with significant changes

   Command:
   $ git merge --no-ff <branch-name>

2. REBASE
   - Creates linear history
   - Rewrites commit history
   - Best for: Keeping history clean, smaller changes

   Command:
   $ git rebase <base-branch>

3. SQUASH
   - Combines all commits into one
   - Clean but loses granular history
   - Best for: Many small commits that should be one logical change

   Command:
   $ git merge --squash <branch-name>

EOF

    print_info "Recommended strategy for Phase 13:"
    echo "  Use MERGE (--no-ff) to preserve parallel development history"
    echo ""
}

# Generate merge commands for a specific branch
generate_merge_commands() {
    local branch=$1
    local target=${2:-$BASE_BRANCH}

    print_header "Merge Commands: $branch → $target"
    echo ""

    cat << EOF
# STEP 1: Create backup branch
$(print_command "git checkout $branch")
$(print_command "git checkout -b ${branch}-backup")
$(print_command "git checkout $target")

# STEP 2: Ensure target branch is up to date
$(print_command "git fetch origin")
$(print_command "git pull origin $target")

# STEP 3: Create merge preparation branch (optional but recommended)
$(print_command "git checkout -b merge-prep-$branch")

# STEP 4: Attempt the merge
$(print_command "git merge --no-ff $branch")

# STEP 5a: If merge succeeds without conflicts
$(print_command "# Run tests")
$(print_command "cargo test --workspace  # For Rust code")
$(print_command "go test ./...           # For Go code")

$(print_command "# If tests pass, push the merge")
$(print_command "git push origin merge-prep-$branch")

$(print_command "# Create pull request or merge to $target")

# STEP 5b: If merge has conflicts
$(print_command "# View conflicting files")
$(print_command "git status")

$(print_command "# For each conflicting file, resolve manually or use mergetool")
$(print_command "git mergetool")

$(print_command "# After resolving all conflicts")
$(print_command "git add .")
$(print_command "git commit -m 'Merge $branch into $target'")

$(print_command "# Run tests")
$(print_command "cargo test --workspace")
$(print_command "go test ./...")

# STEP 6: Clean up
$(print_command "# If merge was successful and tested")
$(print_command "git checkout $target")
$(print_command "git merge --ff-only merge-prep-$branch")
$(print_command "git branch -d merge-prep-$branch")

EOF

    echo ""
}

# Generate all merge commands
generate_all_merge_commands() {
    print_header "Complete Merge Workflow"
    echo ""

    print_info "Recommended merge order:"
    echo "  1. Merge branches with no conflicts first"
    echo "  2. Merge branches with fewer changes next"
    echo "  3. Merge complex branches last"
    echo ""

    for i in "${!BRANCHES[@]}"; do
        echo ""
        print_info "Merge $((i+1)) of ${#BRANCHES[@]}"
        generate_merge_commands "${BRANCHES[$i]}" "$BASE_BRANCH"
        echo ""
        echo "─────────────────────────────────────────────────────────"
        echo ""
    done
}

# Create pull request templates
create_pr_templates() {
    local branch=$1
    local pr_file="pr_template_${branch}.md"

    cat > "$pr_file" << EOF
# Pull Request: Merge $branch into $BASE_BRANCH

## Summary

[Provide a brief description of changes in this branch]

## Changes

- [ ] Component 1: Description
- [ ] Component 2: Description
- [ ] Component 3: Description

## Testing

- [ ] All Rust tests pass (\`cargo test --workspace\`)
- [ ] All Go tests pass (\`go test ./...\`)
- [ ] Integration tests pass
- [ ] Manual testing completed

## Merge Checklist

- [ ] Branch is up to date with base branch
- [ ] No merge conflicts
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated (if needed)
- [ ] CHANGELOG updated (if needed)

## Deployment Notes

[Any special deployment considerations]

## Related Issues

- Closes #[issue number]
- Related to #[issue number]

## Screenshots/Demo

[If applicable, add screenshots or demo links]

---

**Branch:** \`$branch\`
**Target:** \`$BASE_BRANCH\`
**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

    print_success "Created PR template: $pr_file"
}

# Generate PR templates for all branches
generate_all_pr_templates() {
    print_header "Generating Pull Request Templates"
    echo ""

    for branch in "${BRANCHES[@]}"; do
        create_pr_templates "$branch"
    done

    echo ""
    print_success "All PR templates generated"
}

# Show pre-merge checklist
show_premerge_checklist() {
    print_header "Pre-Merge Checklist"
    echo ""

    cat << 'EOF'
Before merging any branch, ensure:

□ Code Quality
  □ All tests passing locally
  □ No linting errors
  □ Code follows project conventions
  □ No debug code or console.logs left in

□ Documentation
  □ README updated if needed
  □ API documentation current
  □ Inline comments for complex logic
  □ CHANGELOG updated

□ Testing
  □ Unit tests cover new code
  □ Integration tests pass
  □ Manual testing completed
  □ Edge cases considered

□ Git Hygiene
  □ Commits are logical and well-described
  □ Branch is up to date with base
  □ No merge conflicts
  □ Backup branch created

□ Review
  □ Code review completed
  □ All review comments addressed
  □ Security considerations reviewed
  □ Performance impact assessed

□ Deployment
  □ Migration scripts ready (if needed)
  □ Rollback plan defined
  □ Feature flags configured (if needed)
  □ Monitoring/alerts set up

EOF

    echo ""
}

# Interactive merge helper
interactive_merge_helper() {
    print_header "Interactive Merge Helper"
    echo ""

    echo "This will guide you through merging a Phase 13 branch."
    echo ""

    # Select branch to merge
    echo "Available branches:"
    for i in "${!BRANCHES[@]}"; do
        echo "  $((i+1)). ${BRANCHES[$i]}"
    done
    echo ""

    read -p "Select branch to merge (1-${#BRANCHES[@]}): " branch_choice

    if [ "$branch_choice" -lt 1 ] || [ "$branch_choice" -gt "${#BRANCHES[@]}" ]; then
        print_error "Invalid selection"
        exit 1
    fi

    local selected_branch="${BRANCHES[$((branch_choice-1))]}"

    print_info "Selected branch: $selected_branch"
    echo ""

    # Verify branch exists
    if ! git rev-parse --verify "$selected_branch" > /dev/null 2>&1; then
        print_error "Branch $selected_branch does not exist locally"
        exit 1
    fi

    # Show current status
    print_info "Current branch status:"
    git log --oneline -5 "$selected_branch"
    echo ""

    # Ask for merge strategy
    echo "Select merge strategy:"
    echo "  1. Merge (--no-ff) - Recommended"
    echo "  2. Rebase"
    echo "  3. Squash"
    echo ""

    read -p "Select strategy (1-3): " strategy_choice

    case $strategy_choice in
        1)
            print_info "Selected: Merge (--no-ff)"
            generate_merge_commands "$selected_branch" "$BASE_BRANCH"
            ;;
        2)
            print_info "Selected: Rebase"
            print_warning "Rebase rewrites history - use with caution!"
            echo ""
            cat << EOF
Rebase workflow:
$(print_command "git checkout $selected_branch")
$(print_command "git rebase $BASE_BRANCH")
$(print_command "# Resolve conflicts if any")
$(print_command "git rebase --continue")
$(print_command "# Force push (only if not shared)")
$(print_command "git push --force-with-lease origin $selected_branch")
EOF
            ;;
        3)
            print_info "Selected: Squash"
            cat << EOF
Squash merge workflow:
$(print_command "git checkout $BASE_BRANCH")
$(print_command "git merge --squash $selected_branch")
$(print_command "git commit -m 'Squashed merge of $selected_branch'")
EOF
            ;;
        *)
            print_error "Invalid selection"
            exit 1
            ;;
    esac

    echo ""
    read -p "Generate PR template for this branch? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_pr_templates "$selected_branch"
    fi

    echo ""
    print_success "Merge preparation complete!"
}

# Show conflict resolution tips
show_conflict_tips() {
    print_header "Conflict Resolution Tips"
    echo ""

    cat << 'EOF'
When you encounter merge conflicts:

1. VIEW CONFLICTS
   $ git status
   $ git diff --name-only --diff-filter=U

2. UNDERSTAND CONFLICT MARKERS
   <<<<<<< HEAD (current branch)
   Your changes
   =======
   Their changes
   >>>>>>> branch-name

3. RESOLVE STRATEGIES

   a) Accept theirs (incoming changes):
      $ git checkout --theirs <file>

   b) Accept ours (current branch):
      $ git checkout --ours <file>

   c) Manual resolution:
      - Edit file in your editor
      - Remove conflict markers
      - Keep the correct code

   d) Use merge tool:
      $ git mergetool

4. AFTER RESOLUTION
   $ git add <resolved-file>
   $ git commit  # or git rebase --continue

5. VERIFY RESOLUTION
   $ cargo test --workspace
   $ go test ./...

6. ABORT IF NEEDED
   $ git merge --abort
   $ git rebase --abort

COMMON CONFLICT SCENARIOS:

- Cargo.lock / package-lock.json: Usually safe to accept theirs
- Source code: Requires careful manual review
- Config files: Often need manual merge
- Documentation: Usually easy to combine

EOF

    echo ""
}

# Main menu
show_menu() {
    clear
    cat << 'EOF'
╔════════════════════════════════════════════════════════╗
║         Phase 13 Merge Helper & Guide                 ║
╚════════════════════════════════════════════════════════╝

EOF

    echo "1. Show merge strategies"
    echo "2. Generate merge commands for all branches"
    echo "3. Generate pull request templates"
    echo "4. Show pre-merge checklist"
    echo "5. Interactive merge helper"
    echo "6. Show conflict resolution tips"
    echo "7. Exit"
    echo ""
    read -p "Select option (1-7): " choice

    case $choice in
        1) show_merge_strategies; pause ;;
        2) generate_all_merge_commands; pause ;;
        3) generate_all_pr_templates; pause ;;
        4) show_premerge_checklist; pause ;;
        5) interactive_merge_helper; pause ;;
        6) show_conflict_tips; pause ;;
        7) exit 0 ;;
        *) print_error "Invalid option"; pause ;;
    esac
}

pause() {
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

# Main execution
main() {
    if [ $# -eq 0 ]; then
        # Interactive mode
        show_menu
    else
        # Command line mode
        case $1 in
            strategies) show_merge_strategies ;;
            commands) generate_all_merge_commands ;;
            pr) generate_all_pr_templates ;;
            checklist) show_premerge_checklist ;;
            tips) show_conflict_tips ;;
            help|--help|-h)
                echo "Usage: $0 [command]"
                echo ""
                echo "Commands:"
                echo "  strategies  - Show merge strategy guide"
                echo "  commands    - Generate merge commands"
                echo "  pr          - Generate PR templates"
                echo "  checklist   - Show pre-merge checklist"
                echo "  tips        - Show conflict resolution tips"
                echo "  help        - Show this help"
                echo ""
                echo "Run without arguments for interactive mode"
                ;;
            *) print_error "Unknown command: $1"; exit 1 ;;
        esac
    fi
}

main "$@"

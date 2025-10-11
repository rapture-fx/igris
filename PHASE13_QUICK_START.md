# Phase 13 Branch Management - Quick Start Guide

**🚀 Fast-track guide for Phase 13 parallel development**

---

## TL;DR - Get Started in 5 Minutes

### Step 1: Create Branches (30 seconds)

```bash
./phase13_branch_management.sh
```

This creates:
- ✅ `phase13-agent1`
- ✅ `phase13-agent2`
- ✅ `phase13-agent3`

---

### Step 2: Start Development

Pick your branch:

```bash
git checkout phase13-agent1  # Or agent2, agent3
```

---

### Step 3: Check for Conflicts (Before Merging)

```bash
./phase13_conflict_detector.sh
```

Review the reports:
- 📄 `phase13_conflict_report.json`
- 📄 `phase13_conflict_report.md`

---

### Step 4: Merge When Ready

```bash
./phase13_merge_helper.sh
```

Follow the interactive prompts or use:

```bash
./phase13_merge_helper.sh commands  # Generate merge commands
./phase13_merge_helper.sh pr        # Create PR templates
```

---

## Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `phase13_branch_management.sh` | Create all branches | `./phase13_branch_management.sh` |
| `phase13_conflict_detector.sh` | Detect merge conflicts | `./phase13_conflict_detector.sh` |
| `phase13_merge_helper.sh` | Merge assistance | `./phase13_merge_helper.sh` |

---

## Safe Merge Procedure (5 steps)

### 1. Backup

```bash
git checkout phase13-agent1
git checkout -b phase13-agent1-backup
```

### 2. Update Base

```bash
git checkout fix/ci-architecture-alignment
git pull origin fix/ci-architecture-alignment
```

### 3. Merge

```bash
git checkout -b merge-prep-agent1
git merge --no-ff phase13-agent1
```

### 4. Test

```bash
cargo test --workspace
go test ./...
```

### 5. Finalize

```bash
git checkout fix/ci-architecture-alignment
git merge --ff-only merge-prep-agent1
git push origin fix/ci-architecture-alignment
```

---

## If You Get Conflicts

```bash
# View conflicts
git status

# Resolve with merge tool
git mergetool

# Or manually edit files, then:
git add .
git commit

# Test
cargo test --workspace
go test ./...
```

---

## Emergency Rollback

```bash
# If merge not pushed yet
git reset --hard HEAD~1

# If merge already pushed
git revert -m 1 HEAD

# If totally stuck
git merge --abort
```

---

## Full Documentation

📚 **Complete Guide:** [PHASE13_BRANCH_MANAGEMENT_GUIDE.md](PHASE13_BRANCH_MANAGEMENT_GUIDE.md)

📊 **JSON Summary:** [phase13_operations_summary.json](phase13_operations_summary.json)

---

## Quick Reference Commands

```bash
# Branch operations
git checkout <branch>              # Switch branch
git checkout -b <new-branch>       # Create branch
git branch -d <branch>             # Delete branch

# Merge operations
git merge --no-ff <branch>         # Merge preserving history
git merge --abort                  # Cancel merge

# Conflict resolution
git status                         # Show conflicts
git checkout --theirs <file>       # Use their version
git checkout --ours <file>         # Use our version

# Testing
cargo test --workspace             # Rust tests
go test ./...                      # Go tests
```

---

## Need Help?

1. **Interactive merge helper:**
   ```bash
   ./phase13_merge_helper.sh
   ```

2. **Check conflict tips:**
   ```bash
   ./phase13_merge_helper.sh tips
   ```

3. **Review full guide:**
   ```bash
   cat PHASE13_BRANCH_MANAGEMENT_GUIDE.md
   ```

---

## Repository Structure

```
main (production)
  │
  └─── fix/ci-architecture-alignment (base - 9 commits ahead)
         │
         ├─── phase13-agent1 (your work here)
         ├─── phase13-agent2 (your work here)
         └─── phase13-agent3 (your work here)
```

---

## Pre-Merge Checklist

- [ ] All tests passing
- [ ] Branch up to date
- [ ] Code reviewed
- [ ] Backup created
- [ ] Conflicts checked

---

**Ready to start?** Run: `./phase13_branch_management.sh` 🚀

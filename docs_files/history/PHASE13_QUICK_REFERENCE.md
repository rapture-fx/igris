# Phase 13 - Quick Reference Card

## 🚀 Create Branches (Start Here!)

```bash
./CREATE_PHASE13_BRANCHES_NOW.sh
```

---

## 🌿 The 4 Branches

| Branch | Purpose |
|--------|---------|
| `cognitive-control` | AI decision-making & autonomous control |
| `validation-suite` | Comprehensive testing & validation |
| `inference-optimizer` | ML inference performance optimization |
| `adaptive-scaling` | Dynamic resource scaling & orchestration |

---

## 📋 Essential Commands

### Switch to Your Branch
```bash
git checkout cognitive-control       # or validation-suite, inference-optimizer, adaptive-scaling
```

### Check Current Status
```bash
git status
git branch --show-current
```

### Make Changes
```bash
# ... edit files ...
git add .
git commit -m "feat: your feature description"
git push origin [branch-name]
```

### Stay in Sync
```bash
git fetch origin
git merge origin/fix/ci-architecture-alignment
```

### Check for Conflicts
```bash
./phase13_conflict_detector.sh
```

---

## 🆘 Quick Help

| Problem | Solution |
|---------|----------|
| Stuck in git pager | Press `q` to quit |
| Uncommitted changes | `git stash` then `git stash pop` |
| Branch already exists | `git branch -D [name]` then recreate |
| Merge conflict | `git mergetool` or edit manually |
| Need guidance | `./phase13_merge_helper.sh` |

---

## ✅ Before Merging Checklist

- [ ] `cargo test --workspace` ✅
- [ ] `go test ./...` ✅
- [ ] `./phase13_conflict_detector.sh` ✅
- [ ] Code review complete ✅
- [ ] Create backup branch ✅

---

## 📂 Key Files

| File | What It Does |
|------|-------------|
| `CREATE_PHASE13_BRANCHES_NOW.sh` | Creates all 4 branches |
| `phase13_conflict_detector.sh` | Detects merge conflicts |
| `phase13_merge_helper.sh` | Interactive merge help |
| `PHASE13_SETUP_COMPLETE.md` | Full documentation |

---

## 🎯 Current Status

✅ **Phase 12 merged to main** (PR #51)
✅ **Base branch clean and ready**
✅ **Ready to create Phase 13 branches**

---

**Start now:** `./CREATE_PHASE13_BRANCHES_NOW.sh` 🚀

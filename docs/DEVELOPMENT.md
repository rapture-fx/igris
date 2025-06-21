# Development Guide - Sherringford Web

##  Quick Start

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Initial Setup
```bash
# Fresh installation (recommended for new setups)
pnpm run fresh-install

# Regular development start
pnpm run dev

# Clean development start (if issues occur)
pnpm run dev:clean
```

##  Available Scripts

| Script | Description | When to Use |
|--------|-------------|-------------|
| `pnpm run dev` | Start development server | Normal development |
| `pnpm run dev:clean` | Clean start with cache clearing | After dependency changes |
| `pnpm run build` | Production build | Before deployment |
| `pnpm run build:clean` | Clean production build | Build issues |
| `pnpm run clean` | Clear Next.js cache | Cache corruption |
| `pnpm run fresh-install` | Complete fresh install | Dependency conflicts |
| `pnpm run lint:fix` | Fix ESLint issues | Code quality |
| `pnpm run type-check` | TypeScript validation | Type errors |

##  Common Issues & Solutions

### 1. Module Resolution Errors
**Error**: `Cannot resolve module` or `MODULE_NOT_FOUND`

**Solution**:
```bash
pnpm run fresh-install
```

### 2. Webpack Vendor Chunk Errors
**Error**: `Can't resolve './vendor-chunks/...`

**Solution**:
```bash
pnpm run clean
pnpm run dev
```

### 3. Port Already in Use
**Error**: `Port 3000 is already in use`

**Solution**:
```bash
# Kill all Next.js processes
pkill -f next
pnpm run dev
```

### 4. Dynamic Tailwind Classes Not Applied
**Error**: Classes not showing in production

**Solution**: Add classes to `tailwind.config.js` safelist or use static classes.

##  Dependency Management

### Adding New Dependencies
```bash
# Add production dependency
pnpm add package-name@exact-version

# Add development dependency  
pnpm add -D package-name@exact-version
```

### Updating Dependencies
```bash
# Check for updates
pnpm run check-deps

# Update all (use cautiously)
pnpm run update-deps
```

### Dependency Best Practices
1. **Use exact versions** (no ^ or ~) in package.json
2. **Test thoroughly** after any dependency change
3. **Update one package at a time** for easier debugging
4. **Document breaking changes** in commit messages

##  Troubleshooting Workflow

### Step 1: Cache Issues
```bash
pnpm run clean
```

### Step 2: Dependency Issues
```bash
pnpm run fresh-install
```

### Step 3: Port Issues
```bash
pkill -f next
```

### Step 4: Build Issues
```bash
pnpm run build:clean
```

### Step 5: Nuclear Option (Last Resort)
```bash
rm -rf node_modules .next pnpm-lock.yaml
pnpm install
pnpm run dev
```

##  Development Best Practices

### 1. Code Organization
- Keep components under 200 lines
- Use TypeScript for all new files
- Follow the existing file structure

### 2. Styling
- Use Tailwind CSS classes consistently
- Avoid dynamic class generation
- Use the safelist for dynamic classes
- Prefer CSS-in-JS for complex animations

### 3. State Management
- Use React Query for server state
- Use React hooks for client state
- Avoid prop drilling beyond 2 levels

### 4. Performance
- Memoize expensive computations
- Use React.memo for stable components
- Optimize images with Next.js Image component

### 5. Error Prevention
- Run `pnpm run type-check` before commits
- Use ESLint autofix: `pnpm run lint:fix`
- Test in both development and production builds

##  Breaking Change Prevention

### Before Making Changes
1. **Create a backup**: `git stash` or create a branch
2. **Document current state**: Note working versions
3. **Test incrementally**: Make small changes
4. **Verify builds**: Run `pnpm run build` after changes

### After Making Changes
1. **Test all pages**: Navigate through the application
2. **Check console**: Look for errors or warnings
3. **Test production build**: `pnpm run build && pnpm start`
4. **Test fresh install**: `pnpm run fresh-install`

##  Health Checks

### Daily Health Check
```bash
# 1. Type checking
pnpm run type-check

# 2. Linting
pnpm run lint

# 3. Build test
pnpm run build

# 4. Dependency audit
pnpm run check-deps
```

### Weekly Health Check
```bash
# 1. Fresh install test
pnpm run fresh-install

# 2. All pages test
# Navigate through all routes manually

# 3. Performance check
# Use browser dev tools to check bundle size

# 4. Dependency updates review
pnpm outdated
```

##  Debugging Tips

### 1. Server Errors
- Check terminal output for specific error messages
- Look for line numbers and file paths
- Use browser dev tools Network tab

### 2. Build Errors
- Check for TypeScript errors first
- Verify all imports are correct
- Check for missing dependencies

### 3. Runtime Errors
- Use React Developer Tools
- Check browser console for JavaScript errors
- Use Next.js built-in error boundary

### 4. Styling Issues
- Use browser dev tools to inspect elements
- Check if Tailwind classes are being applied
- Verify Tailwind configuration

##  Emergency Procedures

### Total System Breakdown
If nothing works and you need to get back to a working state:

```bash
# 1. Backup current changes
git add .
git commit -m "WIP: backup before reset"

# 2. Reset to last known good commit
git log --oneline
git reset --hard [GOOD_COMMIT_HASH]

# 3. Fresh install
pnpm run fresh-install

# 4. Test basic functionality
pnpm run dev
```

### Deployment Issues
If production deployment fails:

```bash
# 1. Test local production build
pnpm run build:clean
pnpm start

# 2. Check environment variables
# 3. Verify all dependencies are in package.json
# 4. Check Next.js configuration
```

##  Success Metrics

Your development environment is healthy when:
-  `pnpm run dev` starts without errors
-  `pnpm run build` completes successfully  
-  `pnpm run type-check` passes
-  `pnpm run lint` shows no errors
-  All pages load without console errors
-  Hot reload works properly

---

**Remember**: When in doubt, start with `pnpm run clean` and escalate to `pnpm run fresh-install` if needed. Most integration issues are cache or dependency related! 
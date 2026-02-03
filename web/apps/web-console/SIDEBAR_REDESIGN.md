# Sidebar Redesign - Unified Nervous System Architecture

**Date:** 2026-02-02
**Status:** ✅ Complete

---

## New Navigation Structure

The sidebar has been completely redesigned to reflect the unified architecture of the Nervous System platform.

### **OVERVIEW**
- 📊 **Dashboard** - Main overview and metrics

### **EXECUTION** ⚡
The runtime layer - where agents execute and operate
- 📦 **Fleet** - Fleet overview and status
- 📱 **Devices** - Device details and management
- ⚙️ **Config** - Configuration push and management
- 🧠 **Models** - Model training and QLoRA

### **INTELLIGENCE** 🧠
The decision-making layer - routing, providers, and cognitive functions
- 🛤️ **Routing** - Routing rules and policies
- 🏢 **Providers** - LLM provider management
- 💰 **Cost** - Cost tracking and quota management
- 👁️ **Shadow Mode** - Shadow testing and validation

### **MEMORY** 💾
The state and learning layer - behavior trees and performance
- 🌳 **BTree** - Behavior tree fleet view
- 🔥 **Performance** - Performance heatmaps and analysis
- ⚠️ **Anomalies** - Anomaly detection and monitoring

### **PROOF** 🛡️
The audit and verification layer - observability and history
- 📊 **Observability** - Traces, logs, and metrics
- 🔔 **Alerts** - Alert configuration and management
- 📜 **History** - Historical replay and audit logs

### **SETTINGS** ⚙️
- 🔧 **Settings** - Platform configuration

---

## Mapping from Old Structure

### Old → New

**Dashboard** → `OVERVIEW / Dashboard`

**Observability** → `PROOF / Observability`

**Overture:**
- Providers → `INTELLIGENCE / Providers`
- Routing Rules → `INTELLIGENCE / Routing`
- Cost & Quota → `INTELLIGENCE / Cost`
- Shadow Mode → `INTELLIGENCE / Shadow Mode`
- ~~Speculative Router~~ (removed from top-level nav)
- ~~Cognitive Advisor~~ (removed from top-level nav)
- ~~Council Mode~~ (removed from top-level nav)
- ~~EscapeVector~~ (removed from top-level nav)

**Runtime:**
- Fleet Overview → `EXECUTION / Fleet`
- Device Details → `EXECUTION / Devices`
- Config Push → `EXECUTION / Config`
- ~~Swarm Status~~ (removed from top-level nav)

**Agents:**
- QLoRA Training → `EXECUTION / Models`
- ~~Planning & Reflection~~ (removed from top-level nav)
- ~~Tools Management~~ (removed from top-level nav)

**BTree Monitoring:**
- Fleet View → `MEMORY / BTree`
- Performance Heatmap → `MEMORY / Performance`
- Anomaly Detection → `MEMORY / Anomalies`
- ~~A/B Testing~~ (removed from top-level nav)
- ~~Optimization Suggestions~~ (removed from top-level nav)
- Historical Replay → `PROOF / History`
- Alerts Configuration → `PROOF / Alerts`

**Settings** → `SETTINGS / Settings`

---

## Design Principles

### 1. **Layered Architecture**
The navigation reflects the system's layered architecture:
- **Execution** - The physical/runtime layer
- **Intelligence** - The decision-making layer
- **Memory** - The state and learning layer
- **Proof** - The verification and audit layer

### 2. **Focused Navigation**
Each section contains only the most essential items (3-4 max) to reduce cognitive load.

### 3. **Clear Separation of Concerns**
- **Execution** = "What's running?"
- **Intelligence** = "How are decisions made?"
- **Memory** = "What's learned and remembered?"
- **Proof** = "Can we verify it?"

### 4. **Progressive Disclosure**
Advanced features (Speculative Router, Council Mode, etc.) are accessible through their parent pages rather than cluttering the sidebar.

---

## Icons Used

| Section | Icon | Semantic Meaning |
|---------|------|------------------|
| Dashboard | LayoutDashboard | Overview/summary view |
| Execution | Zap | Fast, real-time operations |
| Fleet | Boxes | Collection of units |
| Devices | MonitorSmartphone | Physical devices |
| Config | Settings | Configuration |
| Models | Brain | AI models |
| Intelligence | Brain | Cognitive functions |
| Routing | Route | Pathways/decisions |
| Providers | Building2 | Organizations/services |
| Cost | DollarSign | Financial |
| Shadow Mode | Eye | Observation/testing |
| Memory | Database | Storage/persistence |
| BTree | GitBranch | Tree structure |
| Performance | Flame | Heat/activity |
| Anomalies | AlertTriangle | Warnings |
| Proof | Shield | Protection/verification |
| Observability | Activity | Monitoring |
| Alerts | Bell | Notifications |
| History | History | Past events |

---

## Code Changes

**File Modified:** `/components/layout/Sidebar.tsx`

**Lines Changed:** ~150

**New Imports Added:**
```typescript
LayoutDashboard, Boxes, MonitorSmartphone,
Settings as ConfigIcon, Layers, Route,
Building2, History, Database
```

**Navigation Array:** Completely restructured from 8 top-level items to 6:
1. Dashboard (single item)
2. Execution (4 children)
3. Intelligence (4 children)
4. Memory (3 children)
5. Proof (3 children)
6. Settings (single item)

**Total Navigation Items:** Reduced from ~30 to 15 visible items

---

## User Experience Improvements

### Before
- 8 sections, 30+ items
- Unclear grouping
- Feature-oriented (what it does)
- Redundant categories (Runtime vs Agents vs BTree)

### After
- 6 sections, 15 items
- Clear architectural layers
- Purpose-oriented (why you need it)
- Logical flow: Execute → Decide → Remember → Verify

### Navigation Efficiency
- **Fewer clicks** - Related items grouped logically
- **Clearer mental model** - Architecture-based organization
- **Better discoverability** - Predictable placement

---

## Testing

### Visual Test
```bash
cd /Users/wira/Desktop/system/web/apps/web-console
npm run dev
```

Open http://localhost:3000 and verify:
- ✅ All sections expand/collapse correctly
- ✅ Icons render properly
- ✅ Navigation paths work
- ✅ Active states highlight correctly
- ✅ All existing pages still accessible

### Regression Test
Verify these existing pages still work:
- `/dashboard` - Main dashboard
- `/dashboard/runtime/fleet` - Fleet view
- `/dashboard/providers` - Providers
- `/dashboard/policy` - Routing rules
- `/dashboard/usage` - Cost tracking
- `/dashboard/observability` - Observability
- `/dashboard/btree/fleet` - BTree fleet

---

## Future Enhancements

### Phase 2 - Deep Links
Add secondary navigation within each page for advanced features:
- Intelligence/Routing → Speculative Router, Council Mode tabs
- Execution/Fleet → Swarm Status sub-page
- Memory/BTree → A/B Testing, Suggestions sub-pages

### Phase 3 - Contextual Help
Add tooltips explaining each layer:
- "Execution: Monitor and control running agents"
- "Intelligence: Configure decision-making logic"
- "Memory: Track learning and state"
- "Proof: Verify and audit operations"

### Phase 4 - Quick Actions
Add quick action buttons to each section header:
- Execution: "Deploy New Agent"
- Intelligence: "Test Routing Rule"
- Memory: "Export BTree"
- Proof: "Download Audit Log"

---

## Conclusion

The sidebar redesign successfully transforms the navigation from a feature list into an architectural map of the Nervous System platform. Users can now navigate based on **what layer they're working with** rather than **which specific feature they need**, resulting in:

✅ **Clearer mental model** - Architecture-based organization
✅ **Faster navigation** - Fewer items, better grouping
✅ **Better scalability** - Easy to add new features within existing layers
✅ **Unified brand** - Reflects "Nervous System" architecture

---

**Document Version:** 1.0
**Last Updated:** 2026-02-02
**Status:** ✅ Complete

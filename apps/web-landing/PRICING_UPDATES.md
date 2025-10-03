# Pricing Component Updates for Hybrid ML Pipeline

## Changes to Make in `src/components/sections/Pricing.tsx`

### 1. Add New Badge to All Plans

```tsx
// Add after line 197 (in plan highlights section)
{
  name: "Develop",
  title: "Develop",
  basePrice: 99,
  badge: "🆕 Hybrid ML Ready",  // NEW
  // ... rest of config
}
```

### 2. Update Plan Highlights

#### Develop Tier (Replace lines 198-208):
```tsx
highlights: [
  { icon: Activity, text: "5M API calls included" },
  { icon: Database, text: "50GB daily processing limit" },
  { icon: Zap, text: "Hybrid ML Pipeline (batch + streaming)" },  // UPDATED
  { icon: Brain, text: "sklearn + Rust kernels (60-70% memory reduction)" },  // UPDATED
  { icon: Globe, text: "2 WebSocket connections" },
  { icon: CheckCircle, text: "3 pipeline templates (LLM/tabular)" },  // NEW
  { icon: GitBranch, text: "Data lineage (7 days)" },  // NEW
  { icon: Users, text: "3 team members" },
  { icon: Shield, text: "99.0% SLA + basic security" },
  { icon: Headphones, text: "Business hours support" }
]
```

#### Growth Tier (Replace lines 217-231):
```tsx
highlights: [
  { icon: Activity, text: "25M API calls included" },
  { icon: Database, text: "200GB daily processing limit" },
  { icon: Zap, text: "Hybrid ML Pipeline (advanced streaming)" },  // UPDATED
  { icon: Brain, text: "TensorFlow + PyTorch + HuggingFace" },
  { icon: Cpu, text: "70-75% memory reduction (Rust/Arrow)" },  // NEW
  { icon: Globe, text: "10 streaming connections (WebSocket, Kafka, Redis)" },
  { icon: Layers, text: "ML-Ready Export API (S3/GCS/Azure)" },  // NEW
  { icon: GitMerge, text: "Multi-dataset merge (unlimited)" },  // NEW
  { icon: CheckCircle, text: "20 pipeline templates" },  // NEW
  { icon: GitBranch, text: "Data lineage (30 days)" },  // NEW
  { icon: Settings, text: "Bring Your Own Storage", linkText: "Storage", linkUrl: "https://docs.schlep-engine.com/concepts/byos" },
  { icon: Users, text: "15 team members + self-service" },
  { icon: Shield, text: "99.5% SLA + enhanced security" },
  { icon: Headphones, text: "24/7 support" }
]
```

Note: Add import for new icons:
```tsx
import { ..., CheckCircle, GitBranch, GitMerge, Cpu } from 'lucide-react'
```

#### Scale Tier (Replace lines 240-254):
```tsx
highlights: [
  { icon: Activity, text: "100M API calls included" },
  { icon: Database, text: "500GB daily processing limit" },
  { icon: Zap, text: "Hybrid ML Pipeline (enterprise + distributed)" },  // UPDATED
  { icon: Brain, text: "All ML frameworks + large models (up to 32GB)" },  // UPDATED
  { icon: Cpu, text: "75-80% memory reduction + parallel processing" },  // NEW
  { icon: Globe, text: "100+ streaming connections (incl. MQTT, SSE, gRPC)" },
  { icon: Layers, text: "Priority ML-Ready Export (sub-minute)" },  // NEW
  { icon: GitMerge, text: "Intelligent multi-dataset merge" },  // NEW
  { icon: Wrench, text: "Unlimited pipeline templates + custom builder" },  // UPDATED
  { icon: GitBranch, text: "Data lineage (90 days + audit logs)" },  // NEW
  { icon: Settings, text: "Bring Your Own Storage", linkText: "Storage", linkUrl: "https://docs.schlep-engine.com/concepts/byos" },
  { icon: Users, text: "50 team members + full portal" },
  { icon: Shield, text: "99.9% SLA + advanced security" },
  { icon: Headphones, text: "Priority support + Slack channel" }  // UPDATED
]
```

### 3. Add New Feature Category

Insert after line 358 (in features array), before "Data Pipeline Platform":

```tsx
{
  category: "🆕 Hybrid ML Pipeline",
  icon: Zap,
  items: [
    {
      name: "Dual-Mode Ingestion",
      develop: "Batch + basic streaming",
      growth: "Batch + advanced streaming",
      scale: "Batch + enterprise streaming + distributed"
    },
    {
      name: "Memory Efficiency (Rust/Arrow)",
      develop: "60-70% reduction",
      growth: "70-75% reduction",
      scale: "75-80% reduction + parallel"
    },
    {
      name: "ML-Ready Export API",
      develop: false,
      growth: "S3/GCS/Azure export",
      scale: "Priority export + multi-cloud"
    },
    {
      name: "Pipeline Templates",
      develop: "3 basic templates",
      growth: "20 templates (LLM/CV/tabular)",
      scale: "Unlimited + custom builder"
    },
    {
      name: "Multi-Dataset Merge",
      develop: false,
      growth: "Unlimited merges",
      scale: "Unlimited + intelligent balancing"
    },
    {
      name: "Data Quality Pre-Flight",
      develop: "100 checks/month",
      growth: "Unlimited checks",
      scale: "Unlimited + custom rules"
    },
    {
      name: "Data Lineage Tracking",
      develop: "7 days",
      growth: "30 days",
      scale: "90 days + audit logs"
    },
    {
      name: "Zero-Copy ML Framework Integration",
      develop: "sklearn only",
      growth: "TensorFlow + PyTorch + HuggingFace",
      scale: "All frameworks + custom"
    }
  ]
},
```

### 4. Update Existing Feature Categories

#### Update "ML Data Preparation" (lines 372-382):
```tsx
{
  category: "ML Data Preparation",
  icon: Brain,  // Changed from Zap
  items: [
    {
      name: "ML Framework Access",
      develop: "scikit-learn + Rust kernels",
      growth: "+ TensorFlow + PyTorch + HuggingFace",
      scale: "All frameworks + large models (32GB)"
    },
    {
      name: "ML Training Quotas",
      develop: "5 jobs/day, 100 inferences/hour",
      growth: "50 jobs/day, 1,000 inferences/hour",
      scale: "500 jobs/day, 10,000 inferences/hour"
    },
    {
      name: "ML Resource Quotas",
      develop: "2GB memory",
      growth: "8GB memory",
      scale: "32GB memory + GPU acceleration"
    },
    {
      name: "ML Framework Export Support",
      develop: "TensorFlow Only",
      growth: "TensorFlow + PyTorch + Arrow",
      scale: "All Frameworks + Custom + TFRecord"
    },
    {
      name: "Data Registry & Version Control",
      develop: false,
      growth: true,
      scale: "Advanced + Git integration"
    },
    {
      name: "Feature Engineering Pipeline",
      develop: "Basic + Rust kernels",
      growth: "Advanced + memory-optimized",
      scale: "Custom Pipelines + distributed"
    }
  ]
},
```

### 5. Add New FAQ Items

Insert after line 160 (in faqData array, under "Technical & Features"):

```tsx
{
  id: "hybrid-ml-pipeline",
  question: "What is the Hybrid ML Pipeline?",
  answer: "Our Rust-powered dual-mode system that processes data 70-80% more memory-efficiently than traditional tools like pandas. Switch seamlessly between batch processing (for large files) and real-time streaming (for live data) without changing infrastructure. Includes zero-copy Arrow integration with scikit-learn, TensorFlow, PyTorch, and HuggingFace."
},
{
  id: "ml-ready-export",
  question: "How does ML-Ready Export work?",
  answer: "Growth and Scale tiers can export processed data directly to your training infrastructure (S3, GCS, Azure) in framework-specific formats (TFRecord, Parquet, Arrow, JSONL). No intermediate downloads—data goes straight from preprocessing to your model training pipeline. Includes auto-generated HuggingFace dataset cards."
},
{
  id: "pipeline-templates",
  question: "What are pipeline templates?",
  answer: "Pre-built, battle-tested pipelines for common ML use cases: LLM instruction fine-tuning, computer vision preprocessing, tabular ML workflows. Each template includes optimal settings for tokenization, formatting, and export. Develop tier gets 3 templates, Growth tier gets 20 templates, Scale tier gets unlimited + custom pipeline builder."
},
{
  id: "memory-efficiency",
  question: "How do you achieve 70-80% memory reduction?",
  answer: "We use Rust-based Polars kernels with Apache Arrow columnar format for zero-copy operations. Unlike pandas which copies data multiple times, our pipeline uses memory-mapped I/O, lazy evaluation, and direct buffer sharing between Rust and Python. This means you can process 3x larger datasets on the same infrastructure."
},
{
  id: "data-lineage",
  question: "What is data lineage tracking?",
  answer: "Complete audit trail of how your data was transformed from raw to ML-ready. Track every deduplication, tokenization, merge, and export step with timestamps, Git commits, and pipeline versions. Develop tier: 7 days retention, Growth tier: 30 days, Scale tier: 90 days with full audit logs for compliance."
},
```

### 6. Update Taglines

Replace plan taglines (lines 197, 216, 238):

```tsx
// Develop
tagline: "Hybrid ML Pipeline for prototyping.\nRust-powered preprocessing with 60-70% memory reduction.",

// Growth
tagline: "Production ML teams love us.\nAdvanced streaming + ML-ready export to S3/GCS/Azure.",

// Scale
tagline: "Enterprise AI at scale.\nDistributed processing + unlimited pipeline templates.",
```

### 7. Add Hybrid ML Section Header

Insert before the pricing cards (around line 468):

```tsx
{/* Hybrid ML Pipeline Badge */}
<div className="mb-8 text-center">
  <div className="inline-flex items-center px-4 py-2 rounded-full" style={{ backgroundColor: '#e6f0ff', border: '1px solid #1f53d0' }}>
    <Zap className="w-5 h-5 mr-2" style={{ color: '#1f53d0' }} />
    <span className="text-sm font-medium" style={{ color: '#1f53d0' }}>
      🆕 Now with Hybrid ML Pipeline: 70-80% less memory, batch + streaming
    </span>
  </div>
</div>
```

### 8. Update API Calls Display Text

Around line 389 (in "API & Integration" category):

```tsx
{
  name: "API Calls Included",
  develop: "5M calls (batch + streaming)",
  growth: "25M calls (batch + streaming)",
  scale: "100M calls (batch + streaming)"
},
```

## Visual Enhancements

### Add Memory Efficiency Visualization

Insert after pricing cards section:

```tsx
{/* Memory Efficiency Comparison */}
<div className="mt-12 p-8 rounded-lg" style={{ backgroundColor: '#f2f1ed' }}>
  <h3 className="text-2xl font-medium mb-6 text-center" style={{ color: '#1f53d0' }}>
    Why Rust + Arrow = 70-80% Less Memory
  </h3>
  <div className="grid md:grid-cols-2 gap-8">
    <div>
      <h4 className="font-medium mb-4">Traditional (Pandas)</h4>
      <div className="space-y-2">
        <div className="h-8 rounded" style={{ backgroundColor: '#ff6b6b', width: '100%' }}>
          <span className="text-white text-sm px-3 leading-8">2.5 GB</span>
        </div>
        <p className="text-sm text-gray-600">Multiple data copies, row-based storage</p>
      </div>
    </div>
    <div>
      <h4 className="font-medium mb-4">Schlep-Engine (Rust + Arrow)</h4>
      <div className="space-y-2">
        <div className="h-8 rounded" style={{ backgroundColor: '#51cf66', width: '25%' }}>
          <span className="text-white text-sm px-3 leading-8">600 MB</span>
        </div>
        <p className="text-sm text-gray-600">Zero-copy, columnar format, lazy evaluation</p>
      </div>
    </div>
  </div>
  <div className="mt-6 text-center">
    <p className="text-lg font-medium" style={{ color: '#1f53d0' }}>
      76% memory savings = 3x more data on same infrastructure
    </p>
  </div>
</div>
```

## Testing Checklist

- [ ] All new icons imported correctly
- [ ] Badge displays on all tiers
- [ ] Feature comparison table shows hybrid ML category
- [ ] FAQ accordion works with new items
- [ ] Memory efficiency visualization renders
- [ ] Links to BYOS docs work
- [ ] Price calculation still accurate
- [ ] Mobile responsive (test on iPhone/Android)
- [ ] Accessibility (screen reader test)

## Deployment Notes

1. **Update in stages**:
   - Week 1: Add badge + highlights
   - Week 2: Add feature table category
   - Week 3: Add FAQ items
   - Week 4: Add visualizations

2. **A/B test**: Run old vs new pricing for 2 weeks to measure conversion impact

3. **Analytics tracking**: Add events for:
   - Badge click
   - Hybrid ML FAQ expansion
   - Pipeline templates link click
   - ML-ready export hover

4. **SEO updates**: Add meta tags:
   ```html
   <meta name="keywords" content="hybrid ml pipeline, rust data processing, zero-copy ml, memory efficient ml, batch streaming ml">
   <meta name="description" content="Hybrid ML Pipeline with 70-80% memory reduction. Batch + streaming in one API. Export ML-ready data to S3/GCS/Azure.">
   ```

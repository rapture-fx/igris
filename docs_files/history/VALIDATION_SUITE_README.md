# Phase 13 Validation Suite - Quick Start Guide

## Overview

The Phase 13 validation suite provides comprehensive testing infrastructure to certify the safety, correctness, and determinism of cognitive and autonomous components.

## Quick Start

```bash
# Setup validation environment
make -f Makefile.validation setup-validation

# Run cognitive validation tests (30 tests)
make -f Makefile.validation test-cognitive

# Run regression analysis
make -f Makefile.validation test-regression

# Run shadow replay validation
make -f Makefile.validation test-shadow-replay

# Run Phase 13 chaos scenarios
make -f Makefile.validation test-chaos

# Run full certification (71 tests + all scenarios)
make -f Makefile.validation validate-phase13
```

## Test Files

### Core Test Implementations
- **`integration/tests/cognitive_validation.rs`** - 30 cognitive validation tests
- **`integration/tests/phase13_regression.rs`** - Regression suite with Phase 12 baseline
- **`integration/tests/shadow_replay_validation.rs`** - Shadow replay validation engine
- **`chaos/harness_updates/phase13_chaos_scenarios.sh`** - 5 Phase 13 chaos scenarios

### Documentation
- **`validation/reports/cert_matrix.md`** - 71-test certification matrix
- **`validation_status.md`** - Comprehensive status report
- **`Makefile.validation`** - Test automation harness

## Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Cognitive Validation | 30 | ✅ Ready |
| Phase 13 Regression | 18 | ✅ Ready |
| Shadow Replay | 6 | ✅ Ready |
| Chaos Scenarios | 5 | ✅ Ready |
| Certification Matrix | 71 | ✅ Documented |
| **TOTAL** | **130** | **✅ Complete** |

## Success Criteria

- ✅ All CRITICAL tests pass (100%)
- ✅ ≥98% of HIGH priority tests pass
- ✅ ≥95% of MEDIUM priority tests pass
- ✅ Overall pass rate ≥98%
- ✅ Zero CRITICAL regressions detected

## Next Steps

1. Deploy Phase 13 components to staging environment
2. Collect Phase 11/12 telemetry traces (≥10,000 traces)
3. Execute validation suite: `make -f Makefile.validation validate-phase13`
4. Review results in `validation/reports/`
5. Address any failures before production deployment

## CI/CD Integration

Add to your pipeline:

```yaml
validation:
  script:
    - make -f Makefile.validation ci-validate
  artifacts:
    reports:
      - validation/reports/validation_status.md
```

## Support

For questions or issues with the validation suite:
- Review `validation_status.md` for detailed status
- Check `validation/reports/cert_matrix.md` for test specifications
- See `Makefile.validation` for all available commands

---

**Status:** ✅ Infrastructure Complete - Ready for Execution
**Required Pass Rate:** ≥98%
**Created:** 2025-10-12

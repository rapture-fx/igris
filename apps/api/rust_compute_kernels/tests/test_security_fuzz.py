#!/usr/bin/env python3
"""
Security Fuzz Testing for Rust String/Regex Kernels

Tests for:
- Catastrophic backtracking in regex operations
- Denial of service attacks via malicious input
- Buffer overflow and memory safety issues
- Unicode handling edge cases
- Performance degradation attacks
"""

import os
import sys
import time
import random
import string
import threading
from typing import List, Dict, Any, Optional
import signal
from contextlib import contextmanager

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")

try:
    import schlep_compute_kernels as kernels
except ImportError:
    print("❌ Rust kernels not built. Run 'maturin develop' first.")
    sys.exit(1)


class TimeoutException(Exception):
    """Exception raised when operation times out"""
    pass


@contextmanager
def timeout(seconds: float):
    """Context manager for operation timeout"""
    def timeout_handler(signum, frame):
        raise TimeoutException(f"Operation timed out after {seconds}s")

    # Set the signal handler
    old_handler = signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(int(seconds))

    try:
        yield
    finally:
        # Restore the old handler
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)


class SecurityFuzzTester:
    """Security-focused fuzz testing for string operations"""

    def __init__(self):
        self.test_results = []
        self.vulnerability_count = 0

    def generate_malicious_strings(self, count: int = 100) -> List[str]:
        """Generate strings designed to trigger security issues"""
        malicious_strings = []

        # 1. Catastrophic backtracking patterns
        backtrack_patterns = [
            "a" * 1000 + "b",  # Long prefix without match
            "(a+)+b",           # Nested quantifiers
            "a" * 500 + "x" + "a" * 500,  # Pattern in middle
            "(" + "a?" * 50 + ")" + "a" * 50,  # Exponential backtracking
        ]
        malicious_strings.extend(backtrack_patterns)

        # 2. Unicode edge cases
        unicode_cases = [
            "\x00" * 100,      # Null bytes
            "🚀" * 1000,       # Emoji repetition
            "\ufeff" * 500,    # BOM characters
            "\u200b" * 1000,   # Zero-width spaces
            "café" * 500,      # Mixed ASCII/Unicode
            "\ud800\udc00" * 200,  # Surrogate pairs
        ]
        malicious_strings.extend(unicode_cases)

        # 3. Very long strings (potential buffer overflow)
        long_strings = [
            "A" * 10_000,      # Simple repetition
            "AB" * 5_000,      # Pattern repetition
            string.ascii_letters * 400,  # Character cycling
            "".join(chr(i % 256) for i in range(10_000)),  # Full byte range
        ]
        malicious_strings.extend(long_strings)

        # 4. Control characters and special bytes
        control_chars = [
            "".join(chr(i) for i in range(32)),  # Control chars 0-31
            "\r\n" * 1000,     # Line endings
            "\t" * 2000,       # Tabs
            "\x7f" * 1000,     # DEL character
        ]
        malicious_strings.extend(control_chars)

        # 5. Random fuzzing
        for _ in range(count):
            length = random.randint(1, 5000)
            fuzz_string = "".join(
                chr(random.randint(0, 1114111)) for _ in range(length)
                if random.randint(0, 1114111) <= 0x10FFFF  # Valid Unicode range
            )
            try:
                # Validate the string can be encoded
                fuzz_string.encode('utf-8')
                malicious_strings.append(fuzz_string)
            except UnicodeEncodeError:
                pass

        return malicious_strings

    def generate_malicious_regex_patterns(self) -> List[str]:
        """Generate regex patterns designed to cause issues"""
        patterns = [
            # Catastrophic backtracking patterns
            r"(a+)+b",
            r"(a*)*b",
            r"a*a*a*a*a*a*a*a*a*a*b",
            r"(a|a)*b",
            r"([a-zA-Z]+)*b",

            # Complex nested patterns
            r"((a+)*)+b",
            r"(a+b+)*c",
            r"a*b*c*d*e*f*g*h*i*j*k*",

            # Unicode-specific patterns
            r"[🚀-🚀]*",
            r"\p{L}+",  # If Unicode categories supported
            r"[\u0000-\uFFFF]*",

            # Very long patterns
            r"a" * 1000 + "b",
            r"(" + "a?" * 100 + ")",
            r"[" + "".join(chr(i) for i in range(32, 127)) + "]*",
        ]
        return patterns

    def test_string_operations_security(self) -> Dict[str, Any]:
        """Test string operations for security vulnerabilities"""
        print("🔒 Testing string operations security...")

        malicious_strings = self.generate_malicious_strings(50)
        operations = ["length", "upper", "lower", "strip"]

        results = {
            "operations_tested": len(operations),
            "strings_tested": len(malicious_strings),
            "vulnerabilities": [],
            "performance_issues": [],
            "crashes": [],
            "timeouts": []
        }

        for operation in operations:
            print(f"  Testing {operation} operation...")

            for i, test_string in enumerate(malicious_strings):
                try:
                    start_time = time.time()

                    # Test with 5-second timeout
                    with timeout(5.0):
                        result = kernels.fast_string_ops([test_string], operation)

                    execution_time = time.time() - start_time

                    # Flag slow operations as potential DoS vectors
                    if execution_time > 1.0:
                        results["performance_issues"].append({
                            "operation": operation,
                            "string_index": i,
                            "execution_time": execution_time,
                            "string_length": len(test_string),
                            "severity": "HIGH" if execution_time > 3.0 else "MEDIUM"
                        })

                except TimeoutException:
                    results["timeouts"].append({
                        "operation": operation,
                        "string_index": i,
                        "string_length": len(test_string)
                    })
                    self.vulnerability_count += 1

                except Exception as e:
                    results["crashes"].append({
                        "operation": operation,
                        "string_index": i,
                        "error": str(e),
                        "string_length": len(test_string)
                    })
                    self.vulnerability_count += 1

        return results

    def test_regex_catastrophic_backtracking(self) -> Dict[str, Any]:
        """Test regex operations for catastrophic backtracking"""
        print("🔒 Testing regex catastrophic backtracking...")

        malicious_patterns = self.generate_malicious_regex_patterns()
        test_strings = [
            "a" * 100 + "c",  # Should not match most patterns
            "a" * 50 + "b",   # Should match some patterns
            "x" * 1000,       # No match, potential for backtracking
            "",               # Empty string
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaac",  # Long non-match
        ]

        results = {
            "patterns_tested": len(malicious_patterns),
            "test_strings": len(test_strings),
            "vulnerabilities": [],
            "performance_issues": [],
            "timeouts": [],
            "crashes": []
        }

        for i, pattern in enumerate(malicious_patterns):
            print(f"  Testing pattern {i+1}/{len(malicious_patterns)}...")

            for j, test_string in enumerate(test_strings):
                try:
                    start_time = time.time()

                    # Test with 3-second timeout for regex
                    with timeout(3.0):
                        result = kernels.fast_string_ops([test_string], "regex", pattern)

                    execution_time = time.time() - start_time

                    # Flag slow regex operations as potential backtracking
                    if execution_time > 0.5:
                        severity = "HIGH" if execution_time > 2.0 else "MEDIUM"
                        results["performance_issues"].append({
                            "pattern_index": i,
                            "pattern": pattern,
                            "string_index": j,
                            "execution_time": execution_time,
                            "severity": severity
                        })

                except TimeoutException:
                    results["timeouts"].append({
                        "pattern_index": i,
                        "pattern": pattern,
                        "string_index": j,
                        "severity": "CRITICAL"  # Timeout in regex is critical
                    })
                    self.vulnerability_count += 1

                except Exception as e:
                    results["crashes"].append({
                        "pattern_index": i,
                        "pattern": pattern,
                        "string_index": j,
                        "error": str(e)
                    })
                    self.vulnerability_count += 1

        return results

    def test_memory_exhaustion_attacks(self) -> Dict[str, Any]:
        """Test for memory exhaustion vulnerabilities"""
        print("🔒 Testing memory exhaustion attacks...")

        results = {
            "tests_performed": 0,
            "memory_spikes": [],
            "oom_crashes": [],
            "successful_attacks": []
        }

        # Test very large string operations
        large_string_sizes = [100_000, 500_000, 1_000_000]

        for size in large_string_sizes:
            print(f"  Testing {size:,} character strings...")

            test_string = "A" * size
            results["tests_performed"] += 1

            try:
                import psutil
                process = psutil.Process()
                initial_memory = process.memory_info().rss / 1024 / 1024

                start_time = time.time()

                with timeout(10.0):
                    # Test multiple operations that could amplify memory usage
                    lengths = kernels.fast_string_ops([test_string] * 10, "length")
                    upper_strings = kernels.fast_string_ops([test_string] * 5, "upper")

                execution_time = time.time() - start_time
                final_memory = process.memory_info().rss / 1024 / 1024
                memory_increase = final_memory - initial_memory

                if memory_increase > 500:  # >500MB increase
                    results["memory_spikes"].append({
                        "string_size": size,
                        "memory_increase_mb": memory_increase,
                        "execution_time": execution_time,
                        "severity": "HIGH" if memory_increase > 1000 else "MEDIUM"
                    })

            except TimeoutException:
                results["successful_attacks"].append({
                    "attack_type": "timeout",
                    "string_size": size,
                    "severity": "HIGH"
                })
                self.vulnerability_count += 1

            except MemoryError:
                results["oom_crashes"].append({
                    "string_size": size,
                    "severity": "CRITICAL"
                })
                self.vulnerability_count += 1

            except Exception as e:
                results["oom_crashes"].append({
                    "string_size": size,
                    "error": str(e),
                    "severity": "HIGH"
                })
                self.vulnerability_count += 1

        return results

    def test_unicode_normalization_attacks(self) -> Dict[str, Any]:
        """Test Unicode normalization and encoding attacks"""
        print("🔒 Testing Unicode normalization attacks...")

        results = {
            "tests_performed": 0,
            "encoding_issues": [],
            "normalization_issues": [],
            "crashes": []
        }

        # Unicode attack vectors
        unicode_attacks = [
            # Normalization attacks
            "é",          # Single character
            "e\u0301",    # Decomposed form (e + combining acute)
            "\u00e9",     # Composed form
            "\u0065\u0301",  # Another decomposed form

            # Confusable characters
            "А",          # Cyrillic A (looks like Latin A)
            "а",          # Cyrillic a (looks like Latin a)
            "０",         # Fullwidth digit zero
            "𝟎",         # Mathematical bold digit zero

            # Zero-width characters
            "test\u200bzero\u200bwidth",
            "invisible\ufeffbom",
            "rtl\u202eoverflow",

            # Overlong UTF-8 sequences (if handled incorrectly)
            "\xc0\x80",   # Overlong encoding of NULL
            "\xe0\x80\x80",  # Another overlong sequence
        ]

        for i, attack_string in enumerate(unicode_attacks):
            results["tests_performed"] += 1

            try:
                # Test basic operations
                length_result = kernels.fast_string_ops([attack_string], "length")
                upper_result = kernels.fast_string_ops([attack_string], "upper")
                lower_result = kernels.fast_string_ops([attack_string], "lower")

                # Check for unexpected behavior
                if len(length_result) == 0 or not length_result[0].isdigit():
                    results["encoding_issues"].append({
                        "attack_index": i,
                        "attack_string": repr(attack_string),
                        "issue": "Invalid length result",
                        "result": length_result
                    })

            except UnicodeError as e:
                results["encoding_issues"].append({
                    "attack_index": i,
                    "attack_string": repr(attack_string),
                    "error": str(e)
                })

            except Exception as e:
                results["crashes"].append({
                    "attack_index": i,
                    "attack_string": repr(attack_string),
                    "error": str(e)
                })
                self.vulnerability_count += 1

        return results

    def run_comprehensive_security_tests(self) -> Dict[str, Any]:
        """Run all security tests and generate report"""
        print("🛡️  STARTING COMPREHENSIVE SECURITY FUZZ TESTING")
        print("=" * 60)

        start_time = time.time()

        # Run all test categories
        string_ops_results = self.test_string_operations_security()
        regex_results = self.test_regex_catastrophic_backtracking()
        memory_results = self.test_memory_exhaustion_attacks()
        unicode_results = self.test_unicode_normalization_attacks()

        total_time = time.time() - start_time

        # Compile comprehensive results
        results = {
            "test_duration_seconds": total_time,
            "total_vulnerabilities": self.vulnerability_count,
            "test_categories": {
                "string_operations": string_ops_results,
                "regex_backtracking": regex_results,
                "memory_exhaustion": memory_results,
                "unicode_attacks": unicode_results
            },
            "security_score": self._calculate_security_score(),
            "recommendations": self._generate_security_recommendations()
        }

        return results

    def _calculate_security_score(self) -> int:
        """Calculate security score out of 100"""
        if self.vulnerability_count == 0:
            return 100
        elif self.vulnerability_count <= 5:
            return max(80, 100 - self.vulnerability_count * 5)
        elif self.vulnerability_count <= 10:
            return max(50, 80 - (self.vulnerability_count - 5) * 10)
        else:
            return max(0, 50 - (self.vulnerability_count - 10) * 5)

    def _generate_security_recommendations(self) -> List[str]:
        """Generate security recommendations based on findings"""
        recommendations = []

        if self.vulnerability_count == 0:
            recommendations.append("✅ No critical security vulnerabilities detected")
        else:
            recommendations.append(f"⚠️ {self.vulnerability_count} potential vulnerabilities found")

        recommendations.extend([
            "🔒 Implement input sanitization for user-provided regex patterns",
            "⏱️ Add timeout protection for all string operations",
            "🛡️ Consider rate limiting for expensive string operations",
            "📊 Monitor memory usage in production environments",
            "🔍 Regular security audits and penetration testing recommended"
        ])

        return recommendations


def generate_security_report(results: Dict[str, Any]) -> str:
    """Generate a formatted security report"""
    report = []
    report.append("🛡️  SECURITY FUZZ TEST REPORT")
    report.append("=" * 50)

    # Summary
    report.append(f"\n📊 SECURITY SUMMARY")
    report.append(f"Test Duration: {results['test_duration_seconds']:.1f} seconds")
    report.append(f"Security Score: {results['security_score']}/100")
    report.append(f"Total Vulnerabilities: {results['total_vulnerabilities']}")

    # Detailed results by category
    categories = results["test_categories"]

    # String operations
    string_ops = categories["string_operations"]
    report.append(f"\n🔤 STRING OPERATIONS SECURITY")
    report.append(f"  Operations tested: {string_ops['operations_tested']}")
    report.append(f"  Test strings: {string_ops['strings_tested']}")
    report.append(f"  Timeouts: {len(string_ops['timeouts'])}")
    report.append(f"  Crashes: {len(string_ops['crashes'])}")
    report.append(f"  Performance issues: {len(string_ops['performance_issues'])}")

    # Regex backtracking
    regex = categories["regex_backtracking"]
    report.append(f"\n🔍 REGEX BACKTRACKING SECURITY")
    report.append(f"  Patterns tested: {regex['patterns_tested']}")
    report.append(f"  Critical timeouts: {len([t for t in regex['timeouts'] if t.get('severity') == 'CRITICAL'])}")
    report.append(f"  Performance issues: {len(regex['performance_issues'])}")
    report.append(f"  Crashes: {len(regex['crashes'])}")

    # Memory exhaustion
    memory = categories["memory_exhaustion"]
    report.append(f"\n💾 MEMORY EXHAUSTION SECURITY")
    report.append(f"  Tests performed: {memory['tests_performed']}")
    report.append(f"  Memory spikes: {len(memory['memory_spikes'])}")
    report.append(f"  OOM crashes: {len(memory['oom_crashes'])}")
    report.append(f"  Successful attacks: {len(memory['successful_attacks'])}")

    # Unicode attacks
    unicode = categories["unicode_attacks"]
    report.append(f"\n🌐 UNICODE ATTACK SECURITY")
    report.append(f"  Tests performed: {unicode['tests_performed']}")
    report.append(f"  Encoding issues: {len(unicode['encoding_issues'])}")
    report.append(f"  Crashes: {len(unicode['crashes'])}")

    # Recommendations
    report.append(f"\n💡 SECURITY RECOMMENDATIONS")
    for rec in results["recommendations"]:
        report.append(f"  {rec}")

    # Overall assessment
    if results["security_score"] >= 90:
        report.append(f"\n🎯 OVERALL SECURITY: ✅ EXCELLENT")
    elif results["security_score"] >= 70:
        report.append(f"\n🎯 OVERALL SECURITY: ⚠️ GOOD - Minor issues found")
    elif results["security_score"] >= 50:
        report.append(f"\n🎯 OVERALL SECURITY: ❌ FAIR - Security improvements needed")
    else:
        report.append(f"\n🎯 OVERALL SECURITY: 🚨 POOR - Critical vulnerabilities found")

    return "\n".join(report)


def main():
    """Run security fuzz testing"""
    tester = SecurityFuzzTester()

    try:
        results = tester.run_comprehensive_security_tests()
        report = generate_security_report(results)

        print("\n" + report)

        # Save results to file
        import json
        with open("security_fuzz_results.json", "w") as f:
            json.dump(results, f, indent=2, default=str)

        print(f"\n📄 Detailed results saved to: security_fuzz_results.json")

        return results["security_score"] >= 70  # Consider 70+ as passing

    except Exception as e:
        print(f"❌ Security testing failed: {e}")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
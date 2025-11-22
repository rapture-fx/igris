#!/usr/bin/env python3
"""
Quality-Aware Routing Validation Test
Proves Schlep-Engine maintains quality while optimizing costs
Not just "pick the cheapest model"
"""

import requests
import json
import time
import argparse
from collections import defaultdict
from datetime import datetime
import statistics

class QualityRoutingValidator:
    def __init__(self, base_url="http://localhost:8081"):
        self.base_url = base_url
        self.results = {
            'legal_high_quality': [],
            'code_complex': [],
            'casual_summary': []
        }

        # Expected model tiers for each scenario
        self.expected_tiers = {
            'legal_high_quality': ['gpt-4', 'claude-3-opus', 'claude-3-sonnet'],
            'code_complex': ['gpt-4', 'claude-3-sonnet', 'gpt-4-turbo'],
            'casual_summary': ['gpt-3.5-turbo', 'claude-3-haiku', 'claude-instant']
        }

        # Budget constraints
        self.budgets = {
            'legal_high_quality': 0.15,
            'code_complex': 0.08,
            'casual_summary': 0.01
        }

        # Quality thresholds
        self.quality_thresholds = {
            'legal_high_quality': 0.9,
            'code_complex': 0.85,
            'casual_summary': 0.7
        }

    def get_test_prompts(self):
        """Get test prompts for each scenario"""
        return {
            'legal_high_quality': [
                "Draft a legally binding confidentiality agreement between TechStartup Inc. and John Contractor covering intellectual property, non-disclosure terms, and 2-year duration.",
                "Create a comprehensive employment contract for a senior software engineer including non-compete clauses, intellectual property assignment, and termination conditions.",
                "Write a detailed service level agreement (SLA) for a cloud infrastructure provider covering uptime guarantees, support response times, and penalties."
            ],
            'code_complex': [
                "Implement a thread-safe LRU cache in Go with TTL (time-to-live) expiration, eviction callbacks, and size limits. Include full test coverage.",
                "Design and implement a rate limiter using the token bucket algorithm in Python with Redis backend for distributed rate limiting.",
                "Create a PostgreSQL connection pool manager in Go with health checks, automatic reconnection, and graceful shutdown handling."
            ],
            'casual_summary': [
                "Summarize: Team meeting notes - discussed lunch preferences, most want Thai food on Fridays, pizza on Mondays. Budget is $15 per person.",
                "Summarize: Office email about printer being moved from 3rd floor to 2nd floor break room, effective next Monday.",
                "Summarize: Slack message thread about moving the standup time from 9am to 9:30am starting next week."
            ]
        }

    def make_inference_request(self, scenario, prompt, request_id):
        """Make inference request and track quality/cost"""
        url = f"{self.base_url}/v1/infer"

        payload = {
            "model": "auto",  # Let router decide
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 500,
            "temperature": 0.7,
            "metadata": {
                "scenario": scenario,
                "request_id": f"{scenario}-{request_id}",
                "quality_threshold": self.quality_thresholds[scenario]
            }
        }

        headers = {
            "Content-Type": "application/json",
            "X-Trace-ID": f"quality-routing-{scenario}-{request_id}"
        }

        start_time = time.time()

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=60)
            latency = (time.time() - start_time) * 1000

            if response.status_code == 200:
                data = response.json()

                # Extract model used and cost
                model_used = data.get('model', 'unknown')
                usage = data.get('usage', {})

                # Estimate cost (rough estimates)
                cost = self.estimate_cost(model_used, usage)

                # Get response content
                content = ""
                if 'choices' in data and len(data['choices']) > 0:
                    message = data['choices'][0].get('message', {})
                    content = message.get('content', '')

                result = {
                    'scenario': scenario,
                    'request_id': request_id,
                    'prompt': prompt[:100] + "...",
                    'model_used': model_used,
                    'cost': cost,
                    'budget': self.budgets[scenario],
                    'latency_ms': latency,
                    'success': True,
                    'content_length': len(content),
                    'response_preview': content[:200] if content else "",
                    'within_budget': cost <= self.budgets[scenario],
                    'expected_tier': scenario in self.expected_tiers and any(
                        expected in model_used.lower()
                        for expected in [m.lower() for m in self.expected_tiers[scenario]]
                    )
                }

                return result
            else:
                return {
                    'scenario': scenario,
                    'request_id': request_id,
                    'success': False,
                    'error': f"HTTP {response.status_code}",
                    'model_used': 'none',
                    'cost': 0
                }

        except Exception as e:
            return {
                'scenario': scenario,
                'request_id': request_id,
                'success': False,
                'error': str(e),
                'model_used': 'none',
                'cost': 0
            }

    def estimate_cost(self, model, usage):
        """Estimate cost based on model and tokens"""
        # Rough cost estimates (per 1K tokens)
        cost_per_1k = {
            'gpt-4': 0.03,
            'gpt-4-turbo': 0.01,
            'gpt-3.5-turbo': 0.001,
            'claude-3-opus': 0.015,
            'claude-3-sonnet': 0.003,
            'claude-3-haiku': 0.00025,
            'claude-instant': 0.0008
        }

        # Find matching model
        cost_rate = 0.001  # default
        for model_name, rate in cost_per_1k.items():
            if model_name.lower() in model.lower():
                cost_rate = rate
                break

        # Calculate cost
        total_tokens = usage.get('total_tokens', 100)
        return (total_tokens / 1000) * cost_rate

    def run_scenario_tests(self, scenario, iterations=10):
        """Run tests for a specific scenario"""
        print(f"\n{'='*70}")
        print(f"🎯 Testing Scenario: {scenario.upper().replace('_', ' ')}")
        print(f"{'='*70}")
        print(f"Expected Models: {', '.join(self.expected_tiers.get(scenario, ['unknown']))}")
        print(f"Budget Constraint: ${self.budgets[scenario]:.4f} per request")
        print(f"Quality Threshold: {self.quality_thresholds[scenario]:.2f}")
        print(f"Iterations: {iterations}")
        print(f"{'='*70}\n")

        prompts = self.get_test_prompts()[scenario]

        for i in range(iterations):
            prompt = prompts[i % len(prompts)]
            result = self.make_inference_request(scenario, prompt, i)

            self.results[scenario].append(result)

            if result['success']:
                budget_status = "✅" if result.get('within_budget', False) else "❌"
                tier_status = "✅" if result.get('expected_tier', False) else "⚠️"

                print(f"Request {i+1}/{iterations}: "
                      f"Model={result['model_used']:20s} | "
                      f"Cost=${result['cost']:.5f} {budget_status} | "
                      f"Tier {tier_status} | "
                      f"{result['latency_ms']:.0f}ms")
            else:
                print(f"❌ Request {i+1}/{iterations}: Failed - {result.get('error', 'Unknown')}")

            time.sleep(0.5)  # Rate limiting

    def analyze_results(self):
        """Analyze quality-aware routing results"""
        print(f"\n{'='*70}")
        print(f"📊 QUALITY-AWARE ROUTING ANALYSIS")
        print(f"{'='*70}\n")

        overall_stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'within_budget': 0,
            'correct_tier': 0,
            'total_cost': 0.0,
            'avg_cost': 0.0
        }

        for scenario, results in self.results.items():
            if not results:
                continue

            successful = [r for r in results if r['success']]

            if not successful:
                print(f"\n❌ {scenario}: No successful requests")
                continue

            print(f"\n{'Scenario: ' + scenario.upper().replace('_', ' '):-^70}")

            # Model distribution
            model_counts = defaultdict(int)
            for r in successful:
                model_counts[r['model_used']] += 1

            print(f"\n📈 Model Selection Distribution:")
            for model, count in sorted(model_counts.items(), key=lambda x: x[1], reverse=True):
                percentage = (count / len(successful)) * 100
                print(f"  {model:25s}: {count:3d} ({percentage:5.1f}%)")

            # Cost analysis
            costs = [r['cost'] for r in successful]
            budget = self.budgets[scenario]
            within_budget = sum(1 for c in costs if c <= budget)

            print(f"\n💰 Cost Analysis:")
            print(f"  Budget Constraint:  ${budget:.5f}")
            print(f"  Average Cost:       ${statistics.mean(costs):.5f}")
            print(f"  Min Cost:           ${min(costs):.5f}")
            print(f"  Max Cost:           ${max(costs):.5f}")
            print(f"  Within Budget:      {within_budget}/{len(successful)} ({within_budget/len(successful)*100:.1f}%)")

            # Tier correctness
            correct_tier = sum(1 for r in successful if r.get('expected_tier', False))
            tier_accuracy = (correct_tier / len(successful)) * 100

            print(f"\n🎯 Quality Tier Selection:")
            print(f"  Expected Models:    {', '.join(self.expected_tiers[scenario])}")
            print(f"  Correct Tier:       {correct_tier}/{len(successful)} ({tier_accuracy:.1f}%)")

            # Update overall stats
            overall_stats['total_requests'] += len(results)
            overall_stats['successful_requests'] += len(successful)
            overall_stats['within_budget'] += within_budget
            overall_stats['correct_tier'] += correct_tier
            overall_stats['total_cost'] += sum(costs)

        # Overall summary
        print(f"\n{'OVERALL PERFORMANCE':-^70}")

        if overall_stats['successful_requests'] > 0:
            overall_stats['avg_cost'] = overall_stats['total_cost'] / overall_stats['successful_requests']

            print(f"\n📦 Total Statistics:")
            print(f"  Total Requests:     {overall_stats['total_requests']}")
            print(f"  Successful:         {overall_stats['successful_requests']}")
            print(f"  Average Cost:       ${overall_stats['avg_cost']:.5f}")
            print(f"  Total Cost:         ${overall_stats['total_cost']:.4f}")

            budget_rate = (overall_stats['within_budget'] / overall_stats['successful_requests']) * 100
            tier_rate = (overall_stats['correct_tier'] / overall_stats['successful_requests']) * 100

            print(f"\n🎯 Success Criteria:")
            print(f"  Budget Compliance:  {budget_rate:.1f}% (Target: >90%)")
            print(f"  Tier Accuracy:      {tier_rate:.1f}% (Target: >85%)")

            # Success criteria evaluation
            print(f"\n{'Success Criteria Evaluation':-^70}")

            criteria_met = True

            if tier_rate >= 85:
                print(f"✅ Model Selection Accuracy: {tier_rate:.1f}% (Target: >85%)")
            else:
                print(f"❌ Model Selection Accuracy: {tier_rate:.1f}% (Target: >85%) - FAILED")
                criteria_met = False

            if budget_rate >= 90:
                print(f"✅ Budget Compliance: {budget_rate:.1f}% (Target: >90%)")
            else:
                print(f"⚠️  Budget Compliance: {budget_rate:.1f}% (Target: >90%) - WARNING")

            print(f"\n{'='*70}\n")

            if criteria_met:
                print("✅ QUALITY-AWARE ROUTING VALIDATED!")
                print("   Schlep-Engine successfully balances cost and quality")
                return 0
            else:
                print("⚠️  QUALITY-AWARE ROUTING NEEDS IMPROVEMENT")
                print("   Review routing logic and quality thresholds")
                return 1
        else:
            print("\n❌ No successful requests to analyze")
            return 1

    def save_results(self, filename='quality_routing_results.json'):
        """Save results for further analysis"""
        output = {
            'timestamp': datetime.now().isoformat(),
            'test_config': {
                'scenarios': list(self.results.keys()),
                'expected_tiers': self.expected_tiers,
                'budgets': self.budgets,
                'quality_thresholds': self.quality_thresholds
            },
            'results': self.results
        }

        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)

        print(f"\n💾 Results saved to: {filename}")

def main():
    parser = argparse.ArgumentParser(description='Validate quality-aware routing')
    parser.add_argument('--url', default='http://localhost:8081', help='API base URL')
    parser.add_argument('--scenarios', default='legal,code,casual', help='Comma-separated scenarios to test')
    parser.add_argument('--iterations', type=int, default=10, help='Iterations per scenario')
    parser.add_argument('--output', default='quality_routing_results.json', help='Output file')
    args = parser.parse_args()

    validator = QualityRoutingValidator(base_url=args.url)

    print(f"\n{'='*70}")
    print(f"🎯 QUALITY-AWARE ROUTING VALIDATION")
    print(f"{'='*70}")
    print(f"Objective: Prove Schlep-Engine maintains quality while optimizing costs")
    print(f"Not just 'pick the cheapest model'")
    print(f"\nTarget URL: {args.url}")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}")

    # Parse scenarios
    scenarios = args.scenarios.split(',')
    scenario_map = {
        'legal': 'legal_high_quality',
        'code': 'code_complex',
        'casual': 'casual_summary'
    }

    # Run tests for each scenario
    for short_name in scenarios:
        scenario = scenario_map.get(short_name.strip())
        if scenario:
            validator.run_scenario_tests(scenario, args.iterations)
        else:
            print(f"⚠️  Unknown scenario: {short_name}")

    # Analyze results
    exit_code = validator.analyze_results()

    # Save results
    validator.save_results(args.output)

    return exit_code

if __name__ == "__main__":
    import sys
    sys.exit(main())

#!/usr/bin/env python3
"""
Feedback Simulator for Phase 7 Testing

Simulates user feedback submissions to validate analytics collection.
"""

import requests
import json
import time
import random
from datetime import datetime
from typing import Dict, List

class FeedbackSimulator:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.models = ["fraud-detector", "text-classifier", "image-recognizer"]
        self.feedback_types = ["correct", "incorrect", "positive", "negative", "neutral"]

    def generate_feedback(self) -> Dict:
        """Generate random feedback data"""
        return {
            "request_id": f"req_{int(time.time() * 1000)}",
            "model_id": random.choice(self.models),
            "model_version": f"{random.randint(1, 3)}.0.0",
            "type": random.choice(self.feedback_types),
            "user_id": f"user_{random.randint(1, 100)}",
            "latency_ms": random.uniform(10, 200),
            "prediction": random.choice([True, False]),
            "ground_truth": random.choice([True, False]),
            "comment": random.choice([
                "Good prediction",
                "Inaccurate result",
                "Fast response",
                "Could be better",
                None
            ]),
            "metadata": {
                "confidence": random.uniform(0.5, 0.99),
                "region": random.choice(["us-east", "us-west", "eu-west"])
            }
        }

    def submit_feedback(self, feedback: Dict) -> bool:
        """Submit feedback to API"""
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/feedback",
                json=feedback,
                timeout=5
            )
            response.raise_for_status()
            print(f"✓ Submitted feedback for {feedback['model_id']}: {feedback['type']}")
            return True
        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to submit feedback: {e}")
            return False

    def run_simulation(self, num_feedbacks: int = 100, delay_ms: int = 100):
        """Run feedback simulation"""
        print(f"Starting feedback simulation: {num_feedbacks} submissions")
        print(f"Target API: {self.base_url}")
        print("-" * 60)

        successful = 0
        failed = 0

        for i in range(num_feedbacks):
            feedback = self.generate_feedback()

            if self.submit_feedback(feedback):
                successful += 1
            else:
                failed += 1

            if delay_ms > 0:
                time.sleep(delay_ms / 1000.0)

            if (i + 1) % 10 == 0:
                print(f"Progress: {i + 1}/{num_feedbacks} ({successful} success, {failed} failed)")

        print("-" * 60)
        print(f"Simulation complete!")
        print(f"Successful: {successful}/{num_feedbacks}")
        print(f"Failed: {failed}/{num_feedbacks}")
        print(f"Success rate: {successful/num_feedbacks*100:.1f}%")

        return successful, failed

    def verify_stats(self):
        """Verify feedback statistics aggregation"""
        print("\nVerifying feedback statistics...")
        print("-" * 60)

        try:
            response = requests.get(f"{self.base_url}/api/v1/feedback/stats")
            response.raise_for_status()

            stats = response.json()
            print("Feedback Statistics:")
            print(json.dumps(stats, indent=2))

            # Validate stats
            if "models" in stats:
                for model in stats["models"]:
                    print(f"\nModel: {model['model_id']}")
                    print(f"  Total Feedback: {model['total_feedback']}")
                    print(f"  Accuracy Rate: {model.get('accuracy_rate', 0):.2%}")
                    print(f"  Satisfaction Rate: {model.get('satisfaction_rate', 0):.2%}")

            return True
        except requests.exceptions.RequestException as e:
            print(f"✗ Failed to retrieve stats: {e}")
            return False

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Feedback Simulator for Phase 7")
    parser.add_argument("--url", default="http://localhost:8000", help="Base API URL")
    parser.add_argument("--count", type=int, default=100, help="Number of feedbacks to generate")
    parser.add_argument("--delay", type=int, default=100, help="Delay between submissions (ms)")
    parser.add_argument("--verify", action="store_true", help="Verify stats after simulation")

    args = parser.parse_args()

    simulator = FeedbackSimulator(base_url=args.url)

    # Run simulation
    successful, failed = simulator.run_simulation(args.count, args.delay)

    # Verify stats if requested
    if args.verify:
        time.sleep(1)  # Wait for aggregation
        simulator.verify_stats()

if __name__ == "__main__":
    main()

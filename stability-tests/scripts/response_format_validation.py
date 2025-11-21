#!/usr/bin/env python3
"""
Response Format Validation Test
Ensures API responses always return valid JSON with expected structure
Success Criteria: 100% valid JSON, all responses contain required fields
"""

import requests
import json
import sys
from datetime import datetime
from collections import defaultdict

class ResponseFormatValidator:
    def __init__(self, base_url="http://localhost:8080", iterations=100):
        self.base_url = base_url
        self.iterations = iterations
        self.results = {
            'valid': 0,
            'invalid_json': 0,
            'missing_fields': 0,
            'malformed': 0,
            'field_errors': defaultdict(int)
        }

    def validate_response_structure(self, response_data, test_id):
        """Validate OpenAI-compatible response structure"""
        required_fields = ['choices']
        optional_common_fields = ['id', 'object', 'created', 'model', 'usage']

        issues = []

        # Check for choices array
        if 'choices' not in response_data:
            # Check for alternative structure (direct content field)
            if 'content' in response_data:
                return True, []  # Valid alternative structure
            issues.append(f"Missing 'choices' field in response {test_id}")
            self.results['field_errors']['missing_choices'] += 1
            return False, issues

        choices = response_data['choices']
        if not isinstance(choices, list):
            issues.append(f"'choices' is not an array in response {test_id}")
            self.results['field_errors']['choices_not_array'] += 1
            return False, issues

        if len(choices) == 0:
            issues.append(f"'choices' array is empty in response {test_id}")
            self.results['field_errors']['empty_choices'] += 1
            return False, issues

        # Validate first choice structure
        first_choice = choices[0]
        if 'message' not in first_choice and 'text' not in first_choice:
            issues.append(f"Choice missing 'message' or 'text' field in response {test_id}")
            self.results['field_errors']['missing_message'] += 1
            return False, issues

        # If message exists, validate its structure
        if 'message' in first_choice:
            message = first_choice['message']
            if not isinstance(message, dict):
                issues.append(f"'message' is not an object in response {test_id}")
                self.results['field_errors']['message_not_object'] += 1
                return False, issues

            if 'content' not in message:
                issues.append(f"Message missing 'content' field in response {test_id}")
                self.results['field_errors']['missing_content'] += 1
                return False, issues

            if not isinstance(message['content'], str):
                issues.append(f"Content is not a string in response {test_id}")
                self.results['field_errors']['content_not_string'] += 1
                return False, issues

        return len(issues) == 0, issues

    def test_single_request(self, test_id):
        """Test a single request and validate response format"""
        url = f"{self.base_url}/v1/infer"
        payload = {
            "model": "gpt-4" if test_id % 2 == 0 else "claude-3-sonnet",
            "messages": [
                {"role": "user", "content": f"Test {test_id}: What is the capital of France?"}
            ],
            "max_tokens": 50
        }
        headers = {
            "Content-Type": "application/json",
            "X-Trace-ID": f"format-validation-{test_id}"
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            # Try to parse JSON
            try:
                data = response.json()
            except json.JSONDecodeError as e:
                print(f"❌ Test {test_id}: Invalid JSON - {str(e)}")
                print(f"   Response body: {response.text[:200]}")
                self.results['invalid_json'] += 1
                return False

            # Validate structure
            is_valid, issues = self.validate_response_structure(data, test_id)

            if is_valid:
                self.results['valid'] += 1
                if test_id % 10 == 0:
                    print(f"✅ Test {test_id}: Valid response structure")
                return True
            else:
                self.results['missing_fields'] += 1
                print(f"⚠️  Test {test_id}: Structure validation failed")
                for issue in issues:
                    print(f"   - {issue}")
                print(f"   Response: {json.dumps(data, indent=2)[:300]}")
                return False

        except requests.Timeout:
            print(f"⚠️  Test {test_id}: Request timeout")
            return False
        except Exception as e:
            print(f"❌ Test {test_id}: Unexpected error - {str(e)}")
            return False

    def run_validation(self):
        """Run all validation tests"""
        print(f"\n{'='*70}")
        print(f"🔍 RESPONSE FORMAT VALIDATION TEST")
        print(f"{'='*70}")
        print(f"Target URL: {self.base_url}")
        print(f"Iterations: {self.iterations}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*70}\n")

        for i in range(self.iterations):
            self.test_single_request(i)

        self.print_results()

    def print_results(self):
        """Print validation results"""
        total = self.iterations

        print(f"\n{'='*70}")
        print(f"📊 VALIDATION RESULTS")
        print(f"{'='*70}\n")

        valid_rate = (self.results['valid'] / total * 100) if total > 0 else 0

        print(f"✅ Valid Responses: {self.results['valid']} ({valid_rate:.2f}%)")
        print(f"❌ Invalid JSON: {self.results['invalid_json']}")
        print(f"⚠️  Missing/Invalid Fields: {self.results['missing_fields']}")

        if self.results['field_errors']:
            print(f"\n{'Field Error Breakdown':-^70}")
            for error_type, count in sorted(self.results['field_errors'].items(), key=lambda x: x[1], reverse=True):
                print(f"{error_type}: {count}")

        print(f"\n{'Success Criteria':-^70}")
        if valid_rate == 100.0:
            print(f"✅ Response format: 100% valid (Target: 100%)")
            print("\n✅ ALL VALIDATION TESTS PASSED - Response format is consistent!")
            return 0
        else:
            print(f"❌ Response format: {valid_rate:.2f}% valid (Target: 100%) - FAILED")
            print("\n❌ VALIDATION FAILED - Fix response format issues before production")
            return 1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Validate Schlep-engine API response formats')
    parser.add_argument('--url', default='http://localhost:8080', help='Base URL of the API')
    parser.add_argument('--iterations', type=int, default=100, help='Number of test iterations')
    args = parser.parse_args()

    validator = ResponseFormatValidator(
        base_url=args.url,
        iterations=args.iterations
    )

    exit_code = validator.run_validation()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()

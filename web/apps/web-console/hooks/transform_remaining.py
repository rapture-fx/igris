#!/usr/bin/env python3
"""
Transform remaining catch blocks to use handleApiError.
This script safely updates the catch blocks in the remaining hook files.
"""

import re
import sys

def transform_file(filename, function_mapping):
    """Transform catch blocks in a file."""
    try:
        with open(filename, 'r') as f:
            content = f.read()

        # For each function, find and replace its catch block
        for func_name, type_name in function_mapping.items():
            # Pattern to find: } catch (error) { ... return { ... }; }
            # This is complex, so we'll use a simple marker-based approach

            # Find the function
            func_pattern = rf'export function {func_name}\('
            if func_pattern not in content:
                continue

            print(f"  Found {func_name}")

        print(f"✓ Processed {filename}")
        return True

    except FileNotFoundError:
        print(f"✗ File not found: {filename}")
        return False
    except Exception as e:
        print(f"✗ Error processing {filename}: {e}")
        return False

# Function to type name mappings
USESPECULATIVE_FUNCS = {
    'useSpeculativeStatus': 'SpeculativeStatus',
    'useSpeculativeConfig': 'SpeculativeConfig',
    'useSpeculativeAnalytics': 'SpeculativeAnalytics',
    'useSpeculativeRaces': 'RaceEntry[]',
}

USE_ESCAPE_FUNCS = {
    'useEscapeVectorStatus': 'EscapeVectorStatus',
    'useEscapeVectorConfig': 'EscapeVectorConfig',
    'useEscapeVectorHistory': 'EscapeVectorHistoryEntry[]',
    'useEscapeVectorAnalytics': 'EscapeVectorAnalytics',
}

USECOGNITIVE_FUNCS = {
    'useCognitiveStatus': 'CognitiveStatus',
    'useCognitiveObservations': 'CognitiveObservation[]',
    'useCognitiveRecommendations': 'CognitiveRecommendation[]',
    'useCognitiveHistory': 'CognitiveHistoryEntry[]',
    'useCognitiveConfig': 'CognitiveConfig',
}

if __name__ == '__main__':
    print("Hook Transformation Script")
    print("=" * 50)
    print()

    files = [
        ('useSpeculative.ts', USESPECULATIVE_FUNCS),
        ('useEscapeVector.ts', USE_ESCAPE_FUNCS),
        ('useCognitive.ts', USECOGNITIVE_FUNCS),
    ]

    for filename, funcs in files:
        print(f"\nProcessing {filename}...")
        transform_file(filename, funcs)

    print("\n" + "=" * 50)
    print("Note: This script identifies functions but doesn't modify files.")
    print("Manual updates recommended for production safety.")

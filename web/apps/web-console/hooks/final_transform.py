#!/usr/bin/env python3
import re

# Mapping of function names to their return types
TRANSFORMS = {
    'useSpeculative.ts': [
        ('useSpeculativeStatus', 'SpeculativeStatus'),
        ('useSpeculativeConfig', 'SpeculativeConfig'),
        ('useSpeculativeAnalytics', 'SpeculativeAnalytics'),
        ('useSpeculativeRaces', 'RaceEntry[]'),
    ],
    'useEscapeVector.ts': [
        ('useEscapeVectorStatus', 'EscapeVectorStatus'),
        ('useEscapeVectorConfig', 'EscapeVectorConfig'),
        ('useEscapeVectorHistory', 'EscapeVectorHistoryEntry[]'),
        ('useEscapeVectorAnalytics', 'EscapeVectorAnalytics'),
    ],
    'useCognitive.ts': [
        ('useCognitiveStatus', 'CognitiveStatus'),
        ('useCognitiveObservations', 'CognitiveObservation[]'),
        ('useCognitiveRecommendations', 'CognitiveRecommendation[]'),
        ('useCognitiveHistory', 'CognitiveHistoryEntry[]'),
        ('useCognitiveConfig', 'CognitiveConfig'),
    ],
}

def transform_catch_block(content, func_name, type_name):
    """Transform a single catch block."""
    # Find the function
    func_start = content.find(f'export function {func_name}(')
    if func_start == -1:
        return content, False

    # Find the catch block after this function
    catch_start = content.find('} catch (error) {', func_start)
    if catch_start == -1:
        return content, False

    # Find the return statement
    return_start = content.find('return {', catch_start)
    if return_start == -1 or return_start > catch_start + 500:  # Safety check
        return content, False

    # Check if already transformed
    if 'handleApiError' in content[catch_start:return_start + 100]:
        print(f"  ✓ {func_name} already transformed")
        return content, False

    # Find the mock data block
    brace_count = 0
    mock_start = return_start + len('return ')
    i = mock_start
    while i < len(content):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                mock_end = i + 1
                break
        i += 1
    else:
        return content, False

    # Extract the mock data
    mock_data = content[mock_start:mock_end]

    # Create the new return statement
    new_return = f"return handleApiError<{type_name}>(\n          error,\n          {mock_data},\n          '{func_name}'\n        );"

    # Replace
    old_return = f"return {mock_data};"
    new_content = content[:return_start] + new_return + content[mock_end + 1:]

    print(f"  ✓ Transformed {func_name}")
    return new_content, True

def transform_file(filename):
    """Transform all catch blocks in a file."""
    print(f"\nProcessing {filename}...")

    try:
        with open(filename, 'r') as f:
            content = f.read()

        transforms = TRANSFORMS.get(filename, [])
        modified = False

        for func_name, type_name in transforms:
            content, changed = transform_catch_block(content, func_name, type_name)
            modified = modified or changed

        if modified:
            with open(filename, 'w') as f:
                f.write(content)
            print(f"✓ Updated {filename}")
        else:
            print(f"✓ {filename} - no changes needed")

        return True

    except Exception as e:
        print(f"✗ Error: {e}")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("Final Hook Transformation Script")
    print("=" * 60)

    for filename in TRANSFORMS.keys():
        transform_file(filename)

    print("\n" + "=" * 60)
    print("Transformation complete!")

#!/bin/bash

# This script adds the handleApiError import to hook files that don't have it yet

files=("useCognitive.ts" "useShadow.ts" "useSpeculative.ts" "useEscapeVector.ts")

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Check if import already exists
    if ! grep -q "import { handleApiError }" "$file"; then
      # Add import after the constants import
      sed -i.bak '/import.*constants/a\
import { handleApiError } from '\''@/lib/mockDataGuard'\'';
' "$file"
      echo "Added import to $file"
    else
      echo "Import already exists in $file"
    fi
  fi
done

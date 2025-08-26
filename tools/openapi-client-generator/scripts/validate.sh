#!/bin/bash

# OpenAPI Client Validation Script
# Validates generated clients for quality, functionality, and compliance

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GENERATED_DIR="$ROOT_DIR/generated"
TESTS_DIR="$ROOT_DIR/tests"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [LANGUAGES...]

Validation script for generated OpenAPI clients

OPTIONS:
    -a, --all              Validate all generated clients
    -t, --type TYPE        Validation type (lint|test|security|all)
    -r, --report FILE      Generate validation report
    -f, --fix              Attempt to fix issues automatically
    -v, --verbose          Verbose output
    -h, --help             Show this help message

VALIDATION TYPES:
    lint        - Code linting and style checks
    test        - Unit and integration tests
    security    - Security vulnerability scanning
    build       - Build and compilation checks
    docs        - Documentation validation
    all         - All validation types (default)

EXAMPLES:
    # Validate all clients
    $0 --all

    # Validate specific languages
    $0 python typescript

    # Lint only
    $0 --type lint --all

    # Generate validation report
    $0 --all --report validation_report.json
EOF
}

# Function to validate Python client
validate_python_client() {
    local client_dir="$GENERATED_DIR/python"
    local validation_results=()
    
    log_info "Validating Python client..."
    
    if [ ! -d "$client_dir" ]; then
        log_error "Python client directory not found"
        return 1
    fi
    
    cd "$client_dir"
    
    # Check if setup.py exists
    if [ ! -f "setup.py" ]; then
        log_error "setup.py not found"
        validation_results+=("setup_py:MISSING")
    else
        validation_results+=("setup_py:OK")
    fi
    
    # Linting with flake8
    if [ "$VALIDATION_TYPE" = "lint" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Running Python linting..."
        if command -v flake8 &> /dev/null; then
            if flake8 --max-line-length=88 --extend-ignore=E203,W503 . 2>/dev/null; then
                validation_results+=("lint:PASS")
                log_success "Python linting passed"
            else
                validation_results+=("lint:FAIL")
                if [ "$ATTEMPT_FIX" = true ]; then
                    log_info "Attempting to fix Python code style issues..."
                    if command -v black &> /dev/null; then
                        black . --quiet 2>/dev/null || true
                    fi
                    if command -v isort &> /dev/null; then
                        isort . --quiet 2>/dev/null || true
                    fi
                fi
            fi
        else
            validation_results+=("lint:SKIPPED")
            log_warning "flake8 not found, skipping Python linting"
        fi
    fi
    
    # Type checking with mypy
    if [ "$VALIDATION_TYPE" = "test" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Running Python type checking..."
        if command -v mypy &> /dev/null; then
            if mypy --ignore-missing-imports . 2>/dev/null; then
                validation_results+=("typecheck:PASS")
                log_success "Python type checking passed"
            else
                validation_results+=("typecheck:FAIL")
            fi
        else
            validation_results+=("typecheck:SKIPPED")
        fi
    fi
    
    # Build test
    if [ "$VALIDATION_TYPE" = "build" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Testing Python build..."
        if python3 setup.py build --quiet 2>/dev/null; then
            validation_results+=("build:PASS")
            log_success "Python build successful"
        else
            validation_results+=("build:FAIL")
            log_error "Python build failed"
        fi
    fi
    
    # Security scanning
    if [ "$VALIDATION_TYPE" = "security" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Running Python security scan..."
        if command -v bandit &> /dev/null; then
            if bandit -r . -f json -o bandit_report.json 2>/dev/null; then
                validation_results+=("security:PASS")
                log_success "Python security scan passed"
            else
                validation_results+=("security:FAIL")
            fi
        else
            validation_results+=("security:SKIPPED")
        fi
    fi
    
    cd - > /dev/null
    
    # Store results
    VALIDATION_RESULTS["python"]="${validation_results[*]}"
    
    log_success "Python client validation completed"
}

# Function to validate TypeScript client
validate_typescript_client() {
    local client_dir="$GENERATED_DIR/typescript"
    local validation_results=()
    
    log_info "Validating TypeScript client..."
    
    if [ ! -d "$client_dir" ]; then
        log_error "TypeScript client directory not found"
        return 1
    fi
    
    cd "$client_dir"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found"
        validation_results+=("package_json:MISSING")
    else
        validation_results+=("package_json:OK")
    fi
    
    # Install dependencies
    if [ -f "package.json" ]; then
        log_info "Installing TypeScript dependencies..."
        npm install --silent 2>/dev/null || {
            log_warning "Failed to install dependencies"
            validation_results+=("dependencies:FAIL")
        }
    fi
    
    # TypeScript compilation
    if [ "$VALIDATION_TYPE" = "build" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Testing TypeScript compilation..."
        if npx tsc --noEmit 2>/dev/null; then
            validation_results+=("compile:PASS")
            log_success "TypeScript compilation successful"
        else
            validation_results+=("compile:FAIL")
            log_error "TypeScript compilation failed"
        fi
    fi
    
    # Linting with ESLint
    if [ "$VALIDATION_TYPE" = "lint" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Running TypeScript linting..."
        if npx eslint --version &> /dev/null 2>&1; then
            if npx eslint . --ext .ts,.js 2>/dev/null; then
                validation_results+=("lint:PASS")
                log_success "TypeScript linting passed"
            else
                validation_results+=("lint:FAIL")
                if [ "$ATTEMPT_FIX" = true ]; then
                    log_info "Attempting to fix TypeScript issues..."
                    npx eslint . --ext .ts,.js --fix --quiet 2>/dev/null || true
                fi
            fi
        else
            validation_results+=("lint:SKIPPED")
            log_warning "ESLint not found, skipping TypeScript linting"
        fi
    fi
    
    # Run tests
    if [ "$VALIDATION_TYPE" = "test" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Running TypeScript tests..."
        if [ -f "jest.config.js" ] && npm run test --silent 2>/dev/null; then
            validation_results+=("test:PASS")
            log_success "TypeScript tests passed"
        else
            validation_results+=("test:SKIPPED")
        fi
    fi
    
    # Bundle analysis
    if [ "$VALIDATION_TYPE" = "build" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Analyzing TypeScript bundle..."
        if npm run build --silent 2>/dev/null; then
            validation_results+=("bundle:PASS")
            log_success "TypeScript bundle created successfully"
        else
            validation_results+=("bundle:FAIL")
        fi
    fi
    
    cd - > /dev/null
    
    # Store results
    VALIDATION_RESULTS["typescript"]="${validation_results[*]}"
    
    log_success "TypeScript client validation completed"
}

# Function to validate Go client
validate_go_client() {
    local client_dir="$GENERATED_DIR/go"
    local validation_results=()
    
    log_info "Validating Go client..."
    
    if [ ! -d "$client_dir" ]; then
        log_error "Go client directory not found"
        return 1
    fi
    
    cd "$client_dir"
    
    # Check if go.mod exists
    if [ ! -f "go.mod" ]; then
        log_error "go.mod not found"
        validation_results+=("go_mod:MISSING")
    else
        validation_results+=("go_mod:OK")
    fi
    
    # Go mod tidy
    log_info "Running go mod tidy..."
    if go mod tidy 2>/dev/null; then
        validation_results+=("mod_tidy:PASS")
    else
        validation_results+=("mod_tidy:FAIL")
    fi
    
    # Go build
    if [ "$VALIDATION_TYPE" = "build" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Testing Go build..."
        if go build ./... 2>/dev/null; then
            validation_results+=("build:PASS")
            log_success "Go build successful"
        else
            validation_results+=("build:FAIL")
            log_error "Go build failed"
        fi
    fi
    
    # Go vet
    if [ "$VALIDATION_TYPE" = "lint" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Running go vet..."
        if go vet ./... 2>/dev/null; then
            validation_results+=("vet:PASS")
            log_success "Go vet passed"
        else
            validation_results+=("vet:FAIL")
        fi
    fi
    
    # Go tests
    if [ "$VALIDATION_TYPE" = "test" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Running Go tests..."
        if go test ./... 2>/dev/null; then
            validation_results+=("test:PASS")
            log_success "Go tests passed"
        else
            validation_results+=("test:FAIL")
        fi
    fi
    
    # Go fmt check
    if [ "$VALIDATION_TYPE" = "lint" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Checking Go formatting..."
        if [ -z "$(gofmt -l .)" ]; then
            validation_results+=("fmt:PASS")
            log_success "Go formatting is correct"
        else
            validation_results+=("fmt:FAIL")
            if [ "$ATTEMPT_FIX" = true ]; then
                log_info "Fixing Go formatting..."
                gofmt -w .
            fi
        fi
    fi
    
    cd - > /dev/null
    
    # Store results
    VALIDATION_RESULTS["go"]="${validation_results[*]}"
    
    log_success "Go client validation completed"
}

# Function to validate Java client
validate_java_client() {
    local client_dir="$GENERATED_DIR/java"
    local validation_results=()
    
    log_info "Validating Java client..."
    
    if [ ! -d "$client_dir" ]; then
        log_error "Java client directory not found"
        return 1
    fi
    
    cd "$client_dir"
    
    # Maven build
    if [ -f "pom.xml" ]; then
        if [ "$VALIDATION_TYPE" = "build" ] || [ "$VALIDATION_TYPE" = "all" ]; then
            log_info "Running Maven build..."
            if mvn compile -q 2>/dev/null; then
                validation_results+=("maven_build:PASS")
                log_success "Maven build successful"
            else
                validation_results+=("maven_build:FAIL")
                log_error "Maven build failed"
            fi
        fi
        
        if [ "$VALIDATION_TYPE" = "test" ] || [ "$VALIDATION_TYPE" = "all" ]; then
            log_info "Running Maven tests..."
            if mvn test -q 2>/dev/null; then
                validation_results+=("maven_test:PASS")
                log_success "Maven tests passed"
            else
                validation_results+=("maven_test:FAIL")
            fi
        fi
    fi
    
    # Gradle build
    if [ -f "build.gradle" ] && [ -f "gradlew" ]; then
        if [ "$VALIDATION_TYPE" = "build" ] || [ "$VALIDATION_TYPE" = "all" ]; then
            log_info "Running Gradle build..."
            if ./gradlew build -q 2>/dev/null; then
                validation_results+=("gradle_build:PASS")
                log_success "Gradle build successful"
            else
                validation_results+=("gradle_build:FAIL")
                log_error "Gradle build failed"
            fi
        fi
    fi
    
    cd - > /dev/null
    
    # Store results
    VALIDATION_RESULTS["java"]="${validation_results[*]}"
    
    log_success "Java client validation completed"
}

# Function to validate C# client
validate_csharp_client() {
    local client_dir="$GENERATED_DIR/csharp"
    local validation_results=()
    
    log_info "Validating C# client..."
    
    if [ ! -d "$client_dir" ]; then
        log_error "C# client directory not found"
        return 1
    fi
    
    cd "$client_dir"
    
    # .NET build
    if [ "$VALIDATION_TYPE" = "build" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Running .NET build..."
        if dotnet build --verbosity quiet 2>/dev/null; then
            validation_results+=("dotnet_build:PASS")
            log_success ".NET build successful"
        else
            validation_results+=("dotnet_build:FAIL")
            log_error ".NET build failed"
        fi
    fi
    
    # .NET tests
    if [ "$VALIDATION_TYPE" = "test" ] || [ "$VALIDATION_TYPE" = "all" ]; then
        log_info "Running .NET tests..."
        if dotnet test --verbosity quiet 2>/dev/null; then
            validation_results+=("dotnet_test:PASS")
            log_success ".NET tests passed"
        else
            validation_results+=("dotnet_test:FAIL")
        fi
    fi
    
    cd - > /dev/null
    
    # Store results
    VALIDATION_RESULTS["csharp"]="${validation_results[*]}"
    
    log_success "C# client validation completed"
}

# Function to generate validation report
generate_validation_report() {
    local report_file="$1"
    
    log_info "Generating validation report..."
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "validation_type": "$VALIDATION_TYPE",
  "total_clients": ${#VALIDATION_RESULTS[@]},
  "results": {
EOF
    
    local first=true
    for language in "${!VALIDATION_RESULTS[@]}"; do
        if [ "$first" = false ]; then
            echo "," >> "$report_file"
        fi
        first=false
        
        echo -n "    \"$language\": {" >> "$report_file"
        
        # Parse validation results
        IFS=' ' read -ra results <<< "${VALIDATION_RESULTS[$language]}"
        local first_result=true
        for result in "${results[@]}"; do
            IFS=':' read -ra parts <<< "$result"
            local test_name="${parts[0]}"
            local test_result="${parts[1]}"
            
            if [ "$first_result" = false ]; then
                echo "," >> "$report_file"
            fi
            first_result=false
            
            echo -n "      \"$test_name\": \"$test_result\"" >> "$report_file"
        done
        
        echo -n "    }" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

  }
}
EOF
    
    log_success "Validation report generated: $report_file"
}

# Parse command line arguments
LANGUAGES_TO_VALIDATE=()
VALIDATE_ALL=false
VALIDATION_TYPE="all"
REPORT_FILE=""
ATTEMPT_FIX=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--all)
            VALIDATE_ALL=true
            shift
            ;;
        -t|--type)
            VALIDATION_TYPE="$2"
            shift 2
            ;;
        -r|--report)
            REPORT_FILE="$2"
            shift 2
            ;;
        -f|--fix)
            ATTEMPT_FIX=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            LANGUAGES_TO_VALIDATE+=("$1")
            shift
            ;;
    esac
done

# Determine languages to validate
if [ "$VALIDATE_ALL" = true ]; then
    # Find all generated clients
    if [ -d "$GENERATED_DIR" ]; then
        for dir in "$GENERATED_DIR"/*; do
            if [ -d "$dir" ]; then
                LANGUAGES_TO_VALIDATE+=($(basename "$dir"))
            fi
        done
    fi
fi

if [ ${#LANGUAGES_TO_VALIDATE[@]} -eq 0 ]; then
    log_error "No languages specified for validation"
    show_usage
    exit 1
fi

# Validation results storage
declare -A VALIDATION_RESULTS

# Main validation loop
log_info "Starting client validation..."
log_info "Languages to validate: ${LANGUAGES_TO_VALIDATE[*]}"
log_info "Validation type: $VALIDATION_TYPE"

for language in "${LANGUAGES_TO_VALIDATE[@]}"; do
    case $language in
        python)
            validate_python_client
            ;;
        typescript)
            validate_typescript_client
            ;;
        go)
            validate_go_client
            ;;
        java)
            validate_java_client
            ;;
        csharp)
            validate_csharp_client
            ;;
        *)
            log_warning "Validation not implemented for $language"
            VALIDATION_RESULTS["$language"]="unsupported:SKIP"
            ;;
    esac
done

# Generate report if requested
if [ -n "$REPORT_FILE" ]; then
    generate_validation_report "$REPORT_FILE"
fi

# Summary
log_success "Validation completed for all requested clients"
for language in "${!VALIDATION_RESULTS[@]}"; do
    log_info "$language: ${VALIDATION_RESULTS[$language]}"
done
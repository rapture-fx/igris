#!/bin/bash

# OpenAPI Client Publishing Script
# Publishes generated clients to their respective package registries

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GENERATED_DIR="$ROOT_DIR/generated"

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

Publishing script for generated OpenAPI clients

OPTIONS:
    -a, --all              Publish all generated clients
    -t, --test             Publish to test registries only
    -d, --dry-run          Show what would be published without actually publishing
    -f, --force            Force publish even if version exists
    -v, --version VERSION  Override version for publishing
    -h, --help             Show this help message

SUPPORTED REGISTRIES:
    python     - PyPI (https://pypi.org)
    typescript - NPM (https://npmjs.com)
    go         - Go Modules (via GitHub tags)
    java       - Maven Central (via Sonatype OSSRH)
    csharp     - NuGet (https://nuget.org)
    ruby       - RubyGems (https://rubygems.org)
    php        - Packagist (https://packagist.org)

EXAMPLES:
    # Publish all clients
    $0 --all

    # Publish specific languages
    $0 python typescript

    # Dry run for all clients
    $0 --all --dry-run

    # Publish to test registries
    $0 --all --test

    # Force publish with specific version
    $0 python --force --version 2.1.0
EOF
}

# Function to check publishing prerequisites
check_publishing_prerequisites() {
    local language=$1
    
    log_info "Checking publishing prerequisites for $language..."
    
    case $language in
        python)
            if ! command -v twine &> /dev/null; then
                log_error "twine is required for Python publishing. Install with: pip install twine"
                return 1
            fi
            
            if [ -z "$PYPI_USERNAME" ] && [ -z "$PYPI_TOKEN" ]; then
                log_warning "PYPI_USERNAME/PYPI_TOKEN not set. Set credentials for automated publishing."
            fi
            ;;
            
        typescript)
            if ! command -v npm &> /dev/null; then
                log_error "npm is required for TypeScript publishing"
                return 1
            fi
            
            if [ -z "$(npm whoami 2>/dev/null)" ]; then
                log_warning "Not logged into npm. Run 'npm login' for automated publishing."
            fi
            ;;
            
        go)
            if ! command -v git &> /dev/null; then
                log_error "git is required for Go module publishing"
                return 1
            fi
            ;;
            
        java)
            if [ ! -f "$HOME/.m2/settings.xml" ] && [ -z "$MAVEN_USERNAME" ]; then
                log_warning "Maven credentials not configured for automated publishing"
            fi
            ;;
            
        csharp)
            if ! command -v dotnet &> /dev/null; then
                log_error "dotnet CLI is required for C# publishing"
                return 1
            fi
            
            if [ -z "$NUGET_API_KEY" ]; then
                log_warning "NUGET_API_KEY not set for automated publishing"
            fi
            ;;
    esac
    
    log_success "Prerequisites check passed for $language"
}

# Function to get current version
get_current_version() {
    local language=$1
    local client_dir="$GENERATED_DIR/$language"
    
    case $language in
        python)
            if [ -f "$client_dir/setup.py" ]; then
                python3 -c "import sys; sys.path.insert(0, '$client_dir'); exec(open('$client_dir/setup.py').read()); print(version)" 2>/dev/null || echo "0.0.0"
            else
                echo "0.0.0"
            fi
            ;;
            
        typescript)
            if [ -f "$client_dir/package.json" ]; then
                node -pe "require('$client_dir/package.json').version" 2>/dev/null || echo "0.0.0"
            else
                echo "0.0.0"
            fi
            ;;
            
        go)
            # Get version from git tags or default
            git describe --tags --abbrev=0 2>/dev/null | sed 's/^go-v//' || echo "0.0.0"
            ;;
            
        java)
            if [ -f "$client_dir/pom.xml" ]; then
                mvn -f "$client_dir/pom.xml" help:evaluate -Dexpression=project.version -q -DforceStdout 2>/dev/null || echo "0.0.0"
            else
                echo "0.0.0"
            fi
            ;;
            
        csharp)
            if [ -f "$client_dir"/*.csproj ]; then
                dotnet list "$client_dir" package --format json 2>/dev/null | jq -r '.projects[0].frameworks[0].topLevelPackages[0].resolvedVersion // "0.0.0"' || echo "0.0.0"
            else
                echo "0.0.0"
            fi
            ;;
            
        *)
            echo "0.0.0"
            ;;
    esac
}

# Function to increment version
increment_version() {
    local version=$1
    local increment_type=$2  # major, minor, patch
    
    IFS='.' read -ra parts <<< "$version"
    local major=${parts[0]}
    local minor=${parts[1]}
    local patch=${parts[2]}
    
    case $increment_type in
        major)
            echo "$((major + 1)).0.0"
            ;;
        minor)
            echo "$major.$((minor + 1)).0"
            ;;
        patch|*)
            echo "$major.$minor.$((patch + 1))"
            ;;
    esac
}

# Function to update version in files
update_version_in_files() {
    local language=$1
    local new_version=$2
    local client_dir="$GENERATED_DIR/$language"
    
    log_info "Updating version to $new_version in $language client..."
    
    case $language in
        python)
            if [ -f "$client_dir/setup.py" ]; then
                sed -i.bak "s/version='[^']*'/version='$new_version'/g" "$client_dir/setup.py"
                rm -f "$client_dir/setup.py.bak"
            fi
            
            if [ -f "$client_dir/igris_overture_client/__init__.py" ]; then
                sed -i.bak "s/__version__ = '[^']*'/__version__ = '$new_version'/g" "$client_dir/igris_overture_client/__init__.py"
                rm -f "$client_dir/igris_overture_client/__init__.py.bak"
            fi
            ;;
            
        typescript)
            if [ -f "$client_dir/package.json" ]; then
                node -e "
                const fs = require('fs');
                const pkg = JSON.parse(fs.readFileSync('$client_dir/package.json'));
                pkg.version = '$new_version';
                fs.writeFileSync('$client_dir/package.json', JSON.stringify(pkg, null, 2));
                "
            fi
            ;;
            
        java)
            if [ -f "$client_dir/pom.xml" ]; then
                mvn -f "$client_dir/pom.xml" versions:set -DnewVersion="$new_version" -DgenerateBackupPoms=false -q
            fi
            ;;
            
        csharp)
            if [ -f "$client_dir"/*.csproj ]; then
                for csproj in "$client_dir"/*.csproj; do
                    sed -i.bak "s/<Version>[^<]*<\/Version>/<Version>$new_version<\/Version>/g" "$csproj"
                    rm -f "$csproj.bak"
                done
            fi
            ;;
    esac
    
    log_success "Version updated to $new_version"
}

# Function to build package for publishing
build_package() {
    local language=$1
    local client_dir="$GENERATED_DIR/$language"
    
    log_info "Building $language package for publishing..."
    
    cd "$client_dir"
    
    case $language in
        python)
            # Clean previous builds
            rm -rf build/ dist/ *.egg-info/
            
            # Build package
            python3 setup.py sdist bdist_wheel --quiet
            
            if [ ! -d "dist" ] || [ -z "$(ls -A dist/)" ]; then
                log_error "Python package build failed"
                return 1
            fi
            ;;
            
        typescript)
            # Install dependencies and build
            npm install --silent
            npm run build --silent 2>/dev/null || {
                log_warning "Build script not found, skipping build step"
            }
            
            # Pack for publishing
            npm pack --silent
            ;;
            
        java)
            if [ -f "pom.xml" ]; then
                mvn clean package -q -DskipTests
            elif [ -f "build.gradle" ]; then
                ./gradlew build -q
            fi
            ;;
            
        csharp)
            dotnet pack --configuration Release --output ./nupkgs --verbosity quiet
            ;;
            
        go)
            # Go modules don't need building for publishing
            # Just ensure everything compiles
            go build ./...
            ;;
    esac
    
    cd - > /dev/null
    
    log_success "$language package built successfully"
}

# Function to publish to registry
publish_to_registry() {
    local language=$1
    local version=$2
    local client_dir="$GENERATED_DIR/$language"
    
    log_info "Publishing $language client version $version..."
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would publish $language client version $version"
        return 0
    fi
    
    cd "$client_dir"
    
    case $language in
        python)
            local repository_url="https://upload.pypi.org/legacy/"
            if [ "$TEST_PUBLISH" = true ]; then
                repository_url="https://test.pypi.org/legacy/"
            fi
            
            if [ -n "$PYPI_TOKEN" ]; then
                twine upload --repository-url "$repository_url" --username "__token__" --password "$PYPI_TOKEN" dist/*
            elif [ -n "$PYPI_USERNAME" ] && [ -n "$PYPI_PASSWORD" ]; then
                twine upload --repository-url "$repository_url" --username "$PYPI_USERNAME" --password "$PYPI_PASSWORD" dist/*
            else
                log_warning "No PyPI credentials found, attempting interactive upload..."
                twine upload --repository-url "$repository_url" dist/*
            fi
            ;;
            
        typescript)
            local registry="https://registry.npmjs.org"
            if [ "$TEST_PUBLISH" = true ]; then
                log_warning "No test registry available for npm, publishing to main registry with --dry-run"
                npm publish --dry-run
                return 0
            fi
            
            npm publish --access public
            ;;
            
        go)
            # Publish Go module by creating and pushing git tag
            local tag_name="go-v$version"
            
            if git tag -l | grep -q "^$tag_name$"; then
                if [ "$FORCE_PUBLISH" = true ]; then
                    log_info "Deleting existing tag $tag_name"
                    git tag -d "$tag_name"
                    git push origin ":refs/tags/$tag_name" 2>/dev/null || true
                else
                    log_error "Tag $tag_name already exists. Use --force to overwrite."
                    return 1
                fi
            fi
            
            git tag -a "$tag_name" -m "Release Go client version $version"
            git push origin "$tag_name"
            
            log_info "Go module published via tag $tag_name"
            ;;
            
        java)
            if [ -f "pom.xml" ]; then
                if [ "$TEST_PUBLISH" = true ]; then
                    mvn deploy -DaltDeploymentRepository=ossrh-snapshots::default::https://oss.sonatype.org/content/repositories/snapshots -q
                else
                    mvn deploy -q
                fi
            fi
            ;;
            
        csharp)
            local source="https://api.nuget.org/v3/index.json"
            if [ "$TEST_PUBLISH" = true ]; then
                log_warning "Using main NuGet registry (no test registry available)"
            fi
            
            if [ -n "$NUGET_API_KEY" ]; then
                dotnet nuget push "./nupkgs/*.nupkg" --api-key "$NUGET_API_KEY" --source "$source"
            else
                log_error "NUGET_API_KEY is required for publishing"
                return 1
            fi
            ;;
    esac
    
    cd - > /dev/null
    
    log_success "$language client version $version published successfully"
}

# Function to publish client
publish_client() {
    local language=$1
    
    log_info "Starting publication process for $language client..."
    
    local client_dir="$GENERATED_DIR/$language"
    
    if [ ! -d "$client_dir" ]; then
        log_error "$language client directory not found: $client_dir"
        return 1
    fi
    
    # Check prerequisites
    if ! check_publishing_prerequisites "$language"; then
        return 1
    fi
    
    # Determine version to publish
    local current_version
    current_version=$(get_current_version "$language")
    
    local publish_version
    if [ -n "$OVERRIDE_VERSION" ]; then
        publish_version="$OVERRIDE_VERSION"
    else
        publish_version=$(increment_version "$current_version" "patch")
    fi
    
    log_info "Publishing $language client: $current_version -> $publish_version"
    
    # Update version in files
    update_version_in_files "$language" "$publish_version"
    
    # Build package
    if ! build_package "$language"; then
        log_error "Failed to build $language package"
        return 1
    fi
    
    # Publish to registry
    if ! publish_to_registry "$language" "$publish_version"; then
        log_error "Failed to publish $language client"
        return 1
    fi
    
    # Record successful publication
    PUBLISHED_CLIENTS+=("$language:$publish_version")
    
    log_success "$language client published successfully"
}

# Parse command line arguments
LANGUAGES_TO_PUBLISH=()
PUBLISH_ALL=false
TEST_PUBLISH=false
DRY_RUN=false
FORCE_PUBLISH=false
OVERRIDE_VERSION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -a|--all)
            PUBLISH_ALL=true
            shift
            ;;
        -t|--test)
            TEST_PUBLISH=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE_PUBLISH=true
            shift
            ;;
        -v|--version)
            OVERRIDE_VERSION="$2"
            shift 2
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
            LANGUAGES_TO_PUBLISH+=("$1")
            shift
            ;;
    esac
done

# Determine languages to publish
if [ "$PUBLISH_ALL" = true ]; then
    # Find all generated clients
    if [ -d "$GENERATED_DIR" ]; then
        for dir in "$GENERATED_DIR"/*; do
            if [ -d "$dir" ]; then
                LANGUAGES_TO_PUBLISH+=($(basename "$dir"))
            fi
        done
    fi
fi

if [ ${#LANGUAGES_TO_PUBLISH[@]} -eq 0 ]; then
    log_error "No languages specified for publishing"
    show_usage
    exit 1
fi

# Global publishing variables
PUBLISHED_CLIENTS=()

# Main publishing loop
log_info "Starting client publishing process..."
log_info "Languages to publish: ${LANGUAGES_TO_PUBLISH[*]}"

if [ "$DRY_RUN" = true ]; then
    log_info "DRY RUN MODE - No actual publishing will occur"
fi

if [ "$TEST_PUBLISH" = true ]; then
    log_info "TEST MODE - Publishing to test registries where available"
fi

# Validate we're in a git repository for Go publishing
if [[ " ${LANGUAGES_TO_PUBLISH[@]} " =~ " go " ]]; then
    if ! git rev-parse --is-inside-work-tree &> /dev/null; then
        log_error "Go publishing requires a git repository"
        exit 1
    fi
fi

# Publish each client
for language in "${LANGUAGES_TO_PUBLISH[@]}"; do
    if publish_client "$language"; then
        log_success "$language client published"
    else
        log_error "Failed to publish $language client"
    fi
done

# Summary
if [ ${#PUBLISHED_CLIENTS[@]} -gt 0 ]; then
    log_success "Publication completed successfully!"
    log_info "Published clients:"
    for client_info in "${PUBLISHED_CLIENTS[@]}"; do
        IFS=':' read -ra parts <<< "$client_info"
        log_info "  - ${parts[0]} version ${parts[1]}"
    done
else
    log_warning "No clients were published"
fi
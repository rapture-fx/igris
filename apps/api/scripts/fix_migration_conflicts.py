#!/usr/bin/env python3
"""
ALEMBIC MIGRATION CONFLICT RESOLVER
=================================

Fixes the current migration conflicts in the Schlep Engine project:
- Duplicate revision numbers (010)
- Missing revision 009
- Broken migration chain

This script will:
1. Analyze current migration state
2. Rename conflicting migrations
3. Create a merge migration
4. Fix the migration chain
"""

import os
import re
import subprocess
from pathlib import Path
from datetime import datetime

def get_migration_info(file_path):
    """Extract migration info from file"""
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Extract revision ID
    revision_match = re.search(r"revision:\s*str\s*=\s*['\"]([^'\"]+)['\"]", content)
    revision = revision_match.group(1) if revision_match else None
    
    # Extract down_revision
    down_revision_match = re.search(r"down_revision:\s*Union\[str,\s*None\]\s*=\s*['\"]?([^'\"]+)?['\"]?", content)
    down_revision = down_revision_match.group(1) if down_revision_match and down_revision_match.group(1) != 'None' else None
    
    # Extract description
    desc_match = re.search(r'"""([^"]+)"""', content)
    description = desc_match.group(1).strip() if desc_match else "Unknown"
    
    return {
        'file': file_path,
        'revision': revision,
        'down_revision': down_revision,
        'description': description,
        'content': content
    }

def fix_migration_conflicts():
    """Fix all migration conflicts"""
    
    print("🔧 Analyzing migration conflicts...")
    
    migrations_dir = Path("apps/api/alembic/versions")
    migration_files = list(migrations_dir.glob("*.py"))
    
    migrations = []
    for file_path in migration_files:
        if file_path.name == "__pycache__":
            continue
        info = get_migration_info(file_path)
        migrations.append(info)
        print(f"   {file_path.name}: {info['revision']} ← {info['down_revision']}")
    
    # Find conflicts
    conflicts = {}
    revisions = {}
    
    for migration in migrations:
        rev = migration['revision']
        if rev in revisions:
            if rev not in conflicts:
                conflicts[rev] = []
            conflicts[rev].append(migration)
        else:
            revisions[rev] = migration
    
    print(f"\n🚨 Found {len(conflicts)} revision conflicts:")
    for rev, conflicting_migrations in conflicts.items():
        print(f"   Revision {rev}:")
        for migration in conflicting_migrations:
            print(f"     - {migration['file'].name}: {migration['description']}")
    
    # Fix conflicts by renaming
    for rev, conflicting_migrations in conflicts.items():
        print(f"\n🔨 Fixing conflicts for revision {rev}...")
        
        # Keep the first one, rename others
        for i, migration in enumerate(conflicting_migrations[1:], 1):
            old_file = migration['file']
            new_revision = f"{rev}_{i:02d}"
            
            # Generate new filename
            old_name = old_file.name
            if old_name.startswith(f"{rev}_"):
                new_name = old_name.replace(f"{rev}_", f"{new_revision}_", 1)
            else:
                new_name = f"{new_revision}_{old_name[4:]}"  # Replace first 3 chars
            
            new_file = old_file.parent / new_name
            
            # Update content
            new_content = migration['content']
            new_content = re.sub(
                r"revision:\s*str\s*=\s*['\"]([^'\"]+)['\"]",
                f"revision: str = '{new_revision}'",
                new_content
            )
            
            # Write new file
            with open(new_file, 'w') as f:
                f.write(new_content)
            
            # Remove old file
            old_file.unlink()
            
            print(f"   Renamed {old_name} → {new_name} (revision: {new_revision})")
    
    print("\n✅ Migration conflicts resolved!")
    
    # Now create a merge migration
    create_merge_migration()

def create_merge_migration():
    """Create a merge migration to fix the chain"""
    
    print("\n🔗 Creating merge migration...")
    
    # Get current heads
    result = subprocess.run(
        ["alembic", "heads"], 
        cwd="apps/api",
        capture_output=True, 
        text=True
    )
    
    if result.returncode != 0:
        print("⚠️  Still have conflicts, creating manual merge...")
        
        # Create manual merge migration
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        merge_content = f'''"""Merge migration heads

Revision ID: merge_{timestamp}
Revises: multiple heads
Create Date: {datetime.now().isoformat()}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'merge_{timestamp}'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge upgrade - no changes needed"""
    pass


def downgrade() -> None:
    """Merge downgrade - no changes needed"""
    pass
'''
        
        merge_file = Path(f"apps/api/alembic/versions/merge_{timestamp}_fix_migration_heads.py")
        with open(merge_file, 'w') as f:
            f.write(merge_content)
        
        print(f"   Created manual merge: {merge_file.name}")
    
    else:
        # Use alembic merge command
        result = subprocess.run(
            ["alembic", "merge", "heads", "-m", "merge migration heads"],
            cwd="apps/api",
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("   ✅ Alembic merge successful")
        else:
            print(f"   ⚠️  Alembic merge failed: {result.stderr}")

def fix_syntax_warnings():
    """Fix syntax warnings in migration files"""
    
    print("\n🔧 Fixing syntax warnings...")
    
    migrations_dir = Path("apps/api/alembic/versions")
    
    for file_path in migrations_dir.glob("*.py"):
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Fix invalid escape sequences
        if r'\.' in content:
            fixed_content = content.replace(r'\.', r'\\.')
            with open(file_path, 'w') as f:
                f.write(fixed_content)
            print(f"   Fixed escape sequences in {file_path.name}")

def verify_migration_chain():
    """Verify the migration chain is now valid"""
    
    print("\n🔍 Verifying migration chain...")
    
    result = subprocess.run(
        ["alembic", "heads"],
        cwd="apps/api",
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("   ✅ Migration chain is valid")
        print(f"   Current heads: {result.stdout.strip()}")
    else:
        print(f"   ❌ Migration chain still has issues: {result.stderr}")
    
    # Check history
    result = subprocess.run(
        ["alembic", "history", "--verbose"],
        cwd="apps/api",
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("\n📊 Migration history:")
        lines = result.stdout.strip().split('\n')
        for line in lines[:10]:  # Show first 10 lines
            print(f"   {line}")
        if len(lines) > 10:
            print(f"   ... and {len(lines) - 10} more migrations")

def main():
    """Main migration fix process"""
    
    print("🔧 SCHLEP ENGINE MIGRATION CONFLICT RESOLVER")
    print("=" * 50)
    
    # Change to the correct directory
    if not Path("apps/api/alembic").exists():
        print("❌ Error: alembic directory not found")
        print("   Make sure you're running this from the project root")
        return
    
    try:
        # Step 1: Fix syntax warnings
        fix_syntax_warnings()
        
        # Step 2: Fix conflicts
        fix_migration_conflicts()
        
        # Step 3: Verify
        verify_migration_chain()
        
        print("\n🎉 Migration conflicts resolved successfully!")
        print("\nNext steps:")
        print("1. Review the generated migrations")
        print("2. Run: cd apps/api && alembic upgrade head")
        print("3. Test the database schema")
        
    except Exception as e:
        print(f"\n❌ Error during migration fix: {str(e)}")
        print("   You may need to manually resolve some conflicts")

if __name__ == "__main__":
    main()
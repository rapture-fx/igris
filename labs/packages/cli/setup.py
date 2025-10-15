"""
Setup script for Schlep-engine CLI.
This file exists for backward compatibility and editable installs.
"""

from setuptools import setup, find_packages
import os
from pathlib import Path

# Read the contents of README file
this_directory = Path(__file__).parent
long_description = (this_directory / "README.md").read_text(encoding='utf-8')

# Read requirements
def read_requirements(filename):
    """Read requirements from requirements file."""
    requirements_file = this_directory / filename
    if requirements_file.exists():
        with open(requirements_file, 'r', encoding='utf-8') as f:
            return [
                line.strip() 
                for line in f 
                if line.strip() and not line.startswith('#')
            ]
    return []

# Core requirements
install_requires = [
    "click>=8.0.0",
    "rich>=13.0.0", 
    "pydantic>=2.0.0",
    "pyyaml>=6.0",
    "requests>=2.28.0",
    "tqdm>=4.64.0",
    "colorama>=0.4.6",
    "python-dateutil>=2.8.2",
    "typing-extensions>=4.0.0;python_version<'3.9'"
]

# Optional dependencies
extras_require = {
    'dev': [
        "pytest>=7.0.0",
        "pytest-cov>=4.0.0",
        "pytest-mock>=3.10.0",
        "black>=23.0.0",
        "flake8>=6.0.0",
        "mypy>=1.0.0",
        "isort>=5.12.0",
        "pre-commit>=3.0.0",
        "twine>=4.0.0",
        "build>=0.10.0"
    ],
    'test': [
        "pytest>=7.0.0",
        "pytest-cov>=4.0.0",
        "pytest-mock>=3.10.0",
        "responses>=0.23.0",
        "freezegun>=1.2.0"
    ],
    'sdk': [
        "schlep-engine>=1.0.0"
    ]
}

# Add 'all' extra that includes everything
extras_require['all'] = []
for deps in extras_require.values():
    extras_require['all'].extend(deps)

setup(
    name="schlep-engine-cli",
    version="1.0.0",
    author="Schlep-engine",
    author_email="support@schlep-engine.com",
    description="Official command-line interface for Schlep-engine API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/schlep-engine/cli",
    project_urls={
        "Documentation": "https://docs.schlep-engine.com/cli",
        "Bug Tracker": "https://github.com/schlep-engine/cli/issues",
        "Homepage": "https://schlep-engine.com",
        "Repository": "https://github.com/schlep-engine/cli",
        "Changelog": "https://github.com/schlep-engine/cli/blob/main/CHANGELOG.md",
    },
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Environment :: Console",
        "Intended Audience :: Developers",
        "Intended Audience :: Information Technology",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Internet :: WWW/HTTP :: HTTP Servers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Topic :: System :: Systems Administration",
        "Topic :: Utilities",
    ],
    python_requires=">=3.8",
    install_requires=install_requires,
    extras_require=extras_require,
    entry_points={
        "console_scripts": [
            "schlep=schlep_cli.main:cli",
        ],
    },
    keywords=[
        "cli", "data-processing", "machine-learning", "devops", 
        "automation", "pipeline", "batch-processing", "api"
    ],
    include_package_data=True,
    package_data={
        "schlep_cli": ["py.typed"],
    },
    zip_safe=False,
    # Minimum versions for key dependencies
    license="MIT",
    platforms=["any"],
)
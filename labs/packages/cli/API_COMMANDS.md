# Schlep-engine CLI - API Commands Documentation

This document provides comprehensive documentation for all API command modules in the Schlep-engine CLI tool.

## Table of Contents

1. [Analytics Commands](#analytics-commands)
2. [Document Commands](#document-commands)
3. [Quality Commands](#quality-commands)
4. [Storage Commands](#storage-commands)
5. [ML Commands](#ml-commands)
6. [Users Commands](#users-commands)
7. [Admin Commands](#admin-commands)

---

## Analytics Commands

The `analytics` command group provides operations for executing queries, managing reports, and working with datasets.

### Usage

```bash
schlep analytics [COMMAND] [OPTIONS]
```

### Commands

#### `query`

Execute an analytics query against your data.

**Syntax:**
```bash
schlep analytics query QUERY [OPTIONS]
```

**Arguments:**
- `QUERY` - The analytics query to execute (required)

**Options:**
- `--format` - Output format: `json`, `csv`, or `table` (default: `table`)

**Examples:**
```bash
# Execute a query with table output
schlep analytics query "SELECT * FROM sales WHERE amount > 1000"

# Execute a query with JSON output
schlep analytics query "SELECT region, SUM(revenue) FROM sales GROUP BY region" --format json

# Execute a query with CSV output for export
schlep analytics query "SELECT * FROM customers" --format csv > customers.csv
```

#### `create-report`

Create a new analytics report with custom configuration.

**Syntax:**
```bash
schlep analytics create-report NAME [OPTIONS]
```

**Arguments:**
- `NAME` - Name for the new report (required)

**Options:**
- `--config` - Path to report configuration file (JSON or YAML)

**Examples:**
```bash
# Create a report with default settings
schlep analytics create-report "Monthly Sales Report"

# Create a report with custom configuration
schlep analytics create-report "Custom Analytics" --config ./report-config.json
```

**Sample Configuration:**
```json
{
  "query": "SELECT * FROM sales WHERE date >= '2025-01-01'",
  "schedule": "daily",
  "recipients": ["team@example.com"],
  "format": "pdf"
}
```

#### `get-report`

Retrieve an existing analytics report.

**Syntax:**
```bash
schlep analytics get-report REPORT_ID
```

**Arguments:**
- `REPORT_ID` - ID of the report to retrieve (required)

**Examples:**
```bash
schlep analytics get-report report-12345
```

#### `create-dataset`

Create a new analytics dataset from a data source.

**Syntax:**
```bash
schlep analytics create-dataset NAME --source SOURCE
```

**Arguments:**
- `NAME` - Name for the new dataset (required)

**Options:**
- `--source` - Data source identifier or path (required)

**Examples:**
```bash
# Create dataset from database table
schlep analytics create-dataset "CustomerData" --source "db://main/customers"

# Create dataset from file
schlep analytics create-dataset "SalesData" --source "s3://bucket/sales.parquet"
```

#### `list-datasets`

List all available analytics datasets.

**Syntax:**
```bash
schlep analytics list-datasets
```

**Examples:**
```bash
schlep analytics list-datasets
```

---

## Document Commands

The `document` command group provides document processing capabilities including text extraction, table extraction, image extraction, and OCR.

### Usage

```bash
schlep document [COMMAND] [OPTIONS]
```

### Commands

#### `extract-text`

Extract text content from various document formats.

**Syntax:**
```bash
schlep document extract-text FILE --format FORMAT [OPTIONS]
```

**Arguments:**
- `FILE` - Path to the document file (required)

**Options:**
- `--format` - Source document format: `pdf`, `docx`, or `txt` (required)
- `--output` - Path for output file (optional, defaults to stdout)

**Examples:**
```bash
# Extract text from PDF
schlep document extract-text invoice.pdf --format pdf --output invoice.txt

# Extract text from Word document
schlep document extract-text report.docx --format docx --output report.txt

# Extract text and display in terminal
schlep document extract-text document.pdf --format pdf
```

#### `extract-tables`

Extract tables from documents into structured format.

**Syntax:**
```bash
schlep document extract-tables FILE [OPTIONS]
```

**Arguments:**
- `FILE` - Path to the document file (required)

**Options:**
- `--output` - Path for output file (CSV or JSON format)

**Examples:**
```bash
# Extract tables from PDF
schlep document extract-tables financial-report.pdf --output tables.csv

# Extract tables without saving
schlep document extract-tables data.pdf
```

#### `extract-images`

Extract all images from a document.

**Syntax:**
```bash
schlep document extract-images FILE [OPTIONS]
```

**Arguments:**
- `FILE` - Path to the document file (required)

**Options:**
- `--output-dir` - Directory to save extracted images

**Examples:**
```bash
# Extract images to specific directory
schlep document extract-images presentation.pdf --output-dir ./images

# Extract images to current directory
schlep document extract-images document.pdf
```

#### `ocr`

Perform Optical Character Recognition on document images.

**Syntax:**
```bash
schlep document ocr FILE [OPTIONS]
```

**Arguments:**
- `FILE` - Path to the document or image file (required)

**Options:**
- `--language` - OCR language code (default: `eng`)
- `--output` - Path for output text file

**Examples:**
```bash
# Perform OCR on English document
schlep document ocr scanned-invoice.pdf --output invoice-text.txt

# Perform OCR on Spanish document
schlep document ocr documento.jpg --language spa --output documento.txt

# Multiple language OCR
schlep document ocr mixed-doc.pdf --language eng+spa
```

**Supported Languages:**
- `eng` - English
- `spa` - Spanish
- `fra` - French
- `deu` - German
- `chi_sim` - Chinese Simplified
- `jpn` - Japanese
- And many more...

---

## Quality Commands

The `quality` command group provides data quality assessment, rule management, and validation capabilities.

### Usage

```bash
schlep quality [COMMAND] [OPTIONS]
```

### Commands

#### `assess`

Assess data quality for a processing job.

**Syntax:**
```bash
schlep quality assess JOB_ID [OPTIONS]
```

**Arguments:**
- `JOB_ID` - ID of the processing job to assess (required)

**Options:**
- `--format` - Output format: `json` or `table` (default: `table`)

**Examples:**
```bash
# Assess quality with table output
schlep quality assess job-12345

# Assess quality with JSON output
schlep quality assess job-12345 --format json
```

**Quality Metrics:**
- Completeness
- Accuracy
- Consistency
- Timeliness
- Validity
- Uniqueness

#### `create-rule`

Create a new data quality rule.

**Syntax:**
```bash
schlep quality create-rule NAME --config CONFIG
```

**Arguments:**
- `NAME` - Name for the quality rule (required)

**Options:**
- `--config` - Path to rule configuration file (required)

**Examples:**
```bash
schlep quality create-rule "EmailValidation" --config ./rules/email-rule.json
```

**Sample Rule Configuration:**
```json
{
  "type": "validation",
  "field": "email",
  "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
  "severity": "error",
  "message": "Invalid email format"
}
```

#### `validate`

Validate data against specified quality rules.

**Syntax:**
```bash
schlep quality validate JOB_ID RULES...
```

**Arguments:**
- `JOB_ID` - ID of the processing job (required)
- `RULES` - One or more rule IDs to validate against (required)

**Examples:**
```bash
# Validate against single rule
schlep quality validate job-12345 rule-email

# Validate against multiple rules
schlep quality validate job-12345 rule-email rule-phone rule-address
```

#### `list-rules`

List all available quality rules.

**Syntax:**
```bash
schlep quality list-rules
```

**Examples:**
```bash
schlep quality list-rules
```

---

## Storage Commands

The `storage` command group provides file storage operations including upload, download, and file management.

### Usage

```bash
schlep storage [COMMAND] [OPTIONS]
```

### Commands

#### `upload`

Upload a file to cloud storage.

**Syntax:**
```bash
schlep storage upload FILE [OPTIONS]
```

**Arguments:**
- `FILE` - Path to the file to upload (required)

**Options:**
- `--public` / `--private` - Set file visibility (default: private)

**Examples:**
```bash
# Upload private file
schlep storage upload data.csv

# Upload public file
schlep storage upload report.pdf --public

# Upload with custom metadata
schlep storage upload dataset.parquet --private
```

#### `download`

Download a file from cloud storage.

**Syntax:**
```bash
schlep storage download FILE_ID --output OUTPUT
```

**Arguments:**
- `FILE_ID` - ID of the file to download (required)

**Options:**
- `--output` - Output path for downloaded file (required)

**Examples:**
```bash
# Download file
schlep storage download file-abc123 --output ./downloads/data.csv

# Download to current directory
schlep storage download file-xyz789 --output ./report.pdf
```

#### `list`

List all stored files.

**Syntax:**
```bash
schlep storage list [OPTIONS]
```

**Options:**
- `--limit` - Maximum number of files to list (default: 20)

**Examples:**
```bash
# List with default limit
schlep storage list

# List more files
schlep storage list --limit 100
```

#### `delete`

Delete a file from storage.

**Syntax:**
```bash
schlep storage delete FILE_ID [OPTIONS]
```

**Arguments:**
- `FILE_ID` - ID of the file to delete (required)

**Options:**
- `--force` - Skip confirmation prompt

**Examples:**
```bash
# Delete with confirmation
schlep storage delete file-abc123

# Force delete without confirmation
schlep storage delete file-abc123 --force
```

---

## ML Commands

The `ml` command group provides machine learning operations including pipeline management, model training, deployment, and predictions.

### Usage

```bash
schlep ml [COMMAND] [OPTIONS]
```

### Commands

#### `create-pipeline`

Create a new ML pipeline.

**Syntax:**
```bash
schlep ml create-pipeline NAME --config CONFIG [OPTIONS]
```

**Arguments:**
- `NAME` - Name for the ML pipeline (required)

**Options:**
- `--config` - Path to pipeline configuration file (required)
- `--auto-start` - Automatically start the pipeline after creation

**Examples:**
```bash
# Create pipeline
schlep ml create-pipeline "FraudDetection" --config ./ml/fraud-pipeline.yml

# Create and auto-start pipeline
schlep ml create-pipeline "CustomerSegmentation" --config ./ml/segmentation.yml --auto-start
```

**Sample Pipeline Configuration:**
```yaml
name: fraud-detection
type: classification
dataset:
  source: s3://bucket/transactions.parquet
  features:
    - amount
    - merchant_category
    - time_of_day
  target: is_fraud
model:
  algorithm: random_forest
  hyperparameters:
    n_estimators: 100
    max_depth: 10
training:
  validation_split: 0.2
  test_split: 0.1
```

#### `train`

Train an ML model using a pipeline.

**Syntax:**
```bash
schlep ml train PIPELINE_ID [OPTIONS]
```

**Arguments:**
- `PIPELINE_ID` - ID of the pipeline to train (required)

**Options:**
- `--config` - Override configuration file
- `--watch` - Watch training progress in real-time

**Examples:**
```bash
# Start training
schlep ml train pipeline-12345

# Train with custom config
schlep ml train pipeline-12345 --config ./custom-training.yml

# Train and watch progress
schlep ml train pipeline-12345 --watch
```

#### `deploy`

Deploy a trained ML model to an environment.

**Syntax:**
```bash
schlep ml deploy MODEL_ID [OPTIONS]
```

**Arguments:**
- `MODEL_ID` - ID of the trained model to deploy (required)

**Options:**
- `--environment` - Deployment environment: `dev`, `staging`, or `production` (default: `production`)

**Examples:**
```bash
# Deploy to production
schlep ml deploy model-67890

# Deploy to staging
schlep ml deploy model-67890 --environment staging

# Deploy to development
schlep ml deploy model-67890 --environment dev
```

#### `predict`

Make predictions using a deployed model.

**Syntax:**
```bash
schlep ml predict ENDPOINT DATA_FILE [OPTIONS]
```

**Arguments:**
- `ENDPOINT` - Model endpoint URL or ID (required)
- `DATA_FILE` - Path to input data file (required)

**Options:**
- `--output` - Path for prediction results output

**Examples:**
```bash
# Make predictions
schlep ml predict model-endpoint-123 ./input-data.csv --output predictions.json

# Make predictions and display
schlep ml predict fraud-detection ./transactions.csv
```

#### `list-pipelines`

List all ML pipelines.

**Syntax:**
```bash
schlep ml list-pipelines
```

**Examples:**
```bash
schlep ml list-pipelines
```

---

## Users Commands

The `users` command group provides user profile management and API key operations.

### Usage

```bash
schlep users [COMMAND] [OPTIONS]
```

### Commands

#### `profile`

Get user profile information.

**Syntax:**
```bash
schlep users profile [OPTIONS]
```

**Options:**
- `--format` - Output format: `json` or `table` (default: `table`)

**Examples:**
```bash
# Get profile as table
schlep users profile

# Get profile as JSON
schlep users profile --format json
```

#### `update-profile`

Update user profile information.

**Syntax:**
```bash
schlep users update-profile [OPTIONS]
```

**Options:**
- `--name` - Update user's name
- `--email` - Update user's email

**Examples:**
```bash
# Update name
schlep users update-profile --name "John Doe"

# Update email
schlep users update-profile --email "john.doe@example.com"

# Update both
schlep users update-profile --name "John Doe" --email "john.doe@example.com"
```

#### `list-api-keys`

List all API keys for the current user.

**Syntax:**
```bash
schlep users list-api-keys
```

**Examples:**
```bash
schlep users list-api-keys
```

#### `create-api-key`

Create a new API key.

**Syntax:**
```bash
schlep users create-api-key NAME
```

**Arguments:**
- `NAME` - Descriptive name for the API key (required)

**Examples:**
```bash
# Create API key for production
schlep users create-api-key "Production API Key"

# Create API key for development
schlep users create-api-key "Development Testing"
```

**Note:** Save the generated API key immediately as it will only be displayed once.

#### `revoke-api-key`

Revoke an existing API key.

**Syntax:**
```bash
schlep users revoke-api-key KEY_ID
```

**Arguments:**
- `KEY_ID` - ID of the API key to revoke (required)

**Examples:**
```bash
# Revoke API key with confirmation
schlep users revoke-api-key key-abc123
```

**Warning:** This action cannot be undone. Any applications using this key will immediately lose access.

---

## Admin Commands

The `admin` command group provides administrative operations. These commands require admin privileges.

### Usage

```bash
schlep admin [COMMAND] [OPTIONS]
```

**Note:** All admin commands require administrator privileges. Unauthorized access attempts will be logged.

### Commands

#### `list-users`

List all users in the system.

**Syntax:**
```bash
schlep admin list-users [OPTIONS]
```

**Options:**
- `--status` - Filter by user status: `active`, `inactive`, or `suspended`
- `--limit` - Maximum number of users to list (default: 50)

**Examples:**
```bash
# List all users
schlep admin list-users

# List only active users
schlep admin list-users --status active

# List with custom limit
schlep admin list-users --limit 100

# List suspended users
schlep admin list-users --status suspended
```

#### `system-stats`

Get system-wide statistics and metrics.

**Syntax:**
```bash
schlep admin system-stats [OPTIONS]
```

**Options:**
- `--format` - Output format: `json` or `table` (default: `table`)

**Examples:**
```bash
# Get stats as table
schlep admin system-stats

# Get stats as JSON
schlep admin system-stats --format json
```

**Metrics Included:**
- Total users
- Active processing jobs
- Storage usage
- API request counts
- System health status
- Resource utilization

#### `get-user`

Get detailed information about a specific user.

**Syntax:**
```bash
schlep admin get-user USER_ID
```

**Arguments:**
- `USER_ID` - ID of the user to retrieve (required)

**Examples:**
```bash
schlep admin get-user user-12345
```

**Information Displayed:**
- User profile
- Account status
- API keys
- Recent activity
- Resource usage
- Permissions

---

## Common Options

All commands support these common options:

- `--help` - Display help information for the command
- `-v, --verbose` - Enable verbose output
- `--debug` - Enable debug mode for troubleshooting

## Authentication

Most commands require authentication. Ensure you're logged in before using these commands:

```bash
schlep auth login --api-key YOUR_API_KEY
```

To check your authentication status:

```bash
schlep auth status
```

## Configuration

Configure default settings for commands:

```bash
# Set default output format
schlep config set output.format json

# Set default environment
schlep config set ml.default_environment staging

# View all settings
schlep config list
```

## Error Handling

All commands follow consistent error handling:

- Exit code 0: Success
- Exit code 1: General error
- Exit code 2: Invalid arguments
- Exit code 3: Authentication error
- Exit code 4: Permission denied

## Output Formats

Where applicable, commands support multiple output formats:

- **table** - Human-readable table format (default for terminal)
- **json** - Machine-readable JSON format
- **csv** - Comma-separated values for data export

## Examples Workflow

### Complete Analytics Workflow

```bash
# 1. Create a dataset
schlep analytics create-dataset "Q1_Sales" --source "db://warehouse/sales"

# 2. Execute a query
schlep analytics query "SELECT * FROM Q1_Sales WHERE revenue > 10000" --format csv > high-value-sales.csv

# 3. Create a report
schlep analytics create-report "Q1 Performance" --config ./reports/q1-config.json

# 4. Get the report
schlep analytics get-report report-12345
```

### Complete ML Workflow

```bash
# 1. Create ML pipeline
schlep ml create-pipeline "ChurnPrediction" --config ./ml/churn-pipeline.yml

# 2. Train the model
schlep ml train pipeline-12345 --watch

# 3. Deploy to staging
schlep ml deploy model-67890 --environment staging

# 4. Make predictions
schlep ml predict churn-endpoint ./new-customers.csv --output predictions.json

# 5. Deploy to production
schlep ml deploy model-67890 --environment production
```

### Document Processing Workflow

```bash
# 1. Extract text from PDF
schlep document extract-text invoice.pdf --format pdf --output invoice.txt

# 2. Extract tables
schlep document extract-tables invoice.pdf --output invoice-tables.csv

# 3. Extract images
schlep document extract-images invoice.pdf --output-dir ./invoice-images

# 4. Perform OCR on scanned document
schlep document ocr scanned-receipt.jpg --output receipt-text.txt
```

## Support

For additional help:

- Documentation: https://docs.schlep-engine.com
- GitHub Issues: https://github.com/schlep-engine/cli/issues
- Community Forum: https://community.schlep-engine.com

## Version

These commands are available in Schlep-engine CLI v1.0.0 and later.

For changelog and version history, see [CHANGELOG.md](./CHANGELOG.md).

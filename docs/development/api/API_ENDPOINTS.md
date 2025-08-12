# API Endpoints

This document outlines the available API endpoints for the Schlep-engine.

## Base URL
`http://localhost:8000/api/v1` (or your deployed API URL)

## Authentication

### `/api/v1/auth`
*   **Description:** Handles user authentication and authorization.
*   **Endpoints:**
    *   `POST /api/v1/auth/login`: User login.
    *   `POST /api/v1/auth/register`: User registration.
    *   `GET /api/v1/auth/me`: Get current user information (requires authentication).
*   **Details:** (To be added: Request/Response schemas, authentication methods, error codes)

## Users

### `/api/v1/users`
*   **Description:** Manages user accounts and profiles.
*   **Endpoints:**
    *   `GET /api/v1/users/{user_id}`: Retrieve user by ID.
    *   `PUT /api/v1/users/{user_id}`: Update user information.
    *   `DELETE /api/v1/users/{user_id}`: Delete user account.
*   **Details:** (To be added: Request/Response schemas, authorization, error codes)

## ML Pipeline

### `/api/v1/ml`
*   **Description:** Provides endpoints for machine learning model inference and management.
*   **Endpoints:**
    *   `POST /api/v1/ml/predict`: Make a prediction using a trained model.
    *   `GET /api/v1/ml/models`: List available ML models.
*   **Details:** (To be added: Input/output formats, model details, error handling)

## Storage

### `/api/v1/storage`
*   **Description:** Manages file storage and retrieval.
*   **Endpoints:**
    *   `POST /api/v1/storage/upload`: Upload a file.
    *   `GET /api/v1/storage/download/{file_id}`: Download a file.
*   **Details:** (To be added: Supported file types, storage limits, security)

## Document Extraction

### `/api/v1/extract`
*   **Description:** Extracts data from various document types.
*   **Endpoints:**
    *   `POST /api/v1/extract/document`: Extract data from an uploaded document.
*   **Details:** (To be added: Supported document formats, extraction capabilities, output structure)

## Data Quality & Preparation

### `/api/v1/quality`
*   **Description:** Tools for data cleaning, validation, and preparation.
*   **Endpoints:**
    *   `POST /api/v1/quality/clean`: Clean and standardize data.
    *   `POST /api/v1/quality/validate`: Validate data against predefined rules.
*   **Details:** (To be added: Data formats, validation rules, transformation options)

## Use Case Validation

### `/api/v1/validation`
*   **Description:** Validates data against specific use case requirements.
*   **Endpoints:**
    *   `POST /api/v1/validation/run`: Run use case specific validation.
*   **Details:** (To be added: Use case definitions, validation criteria)

## Health & Monitoring

### `/api/v1/health`
*   **Description:** Provides health status of the API.
*   **Endpoints:**
    *   `GET /api/v1/health`: Basic health check.

### `/api/v1/metrics`
*   **Description:** Exposes application metrics.
*   **Endpoints:**
    *   `GET /api/v1/metrics`: Prometheus metrics endpoint.

## Admin

### `/api/v1/admin`
*   **Description:** Administrative functions for managing the API.
*   **Endpoints:**
    *   `GET /api/v1/admin/users`: List all users (admin only).
    *   `DELETE /api/v1/admin/users/{user_id}`: Delete user (admin only).
*   **Details:** (To be added: Admin privileges, sensitive operations)

## API Status & Monitoring

### `/api/v1/api_status`
*   **Description:** Provides detailed API status and monitoring information.
*   **Endpoints:**
    *   `GET /api/v1/api_status`: Get detailed API status.
*   **Details:** (To be added: Status indicators, uptime, performance metrics)

## Root Endpoint

### `/`
*   **Description:** Provides basic information about the API.
*   **Endpoints:**
    *   `GET /`: Welcome message, version, environment, and links to documentation/health.

## System Information

### `/system/info`
*   **Description:** Provides system-level information about the API server.
*   **Endpoints:**
    *   `GET /system/info`: CPU, memory, disk, and network usage.
*   **Details:** (To be added: Data points, units)

---

**Note:** This document is a work in progress. Detailed request/response schemas, parameters, examples, and error codes will be added for each endpoint to ensure comprehensive and developer-friendly documentation.

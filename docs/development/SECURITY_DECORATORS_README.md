# Security Decorators

Simple decorators to add security features to existing endpoints with **zero changes** to your business logic.

## Quick Start

```python
from app.middleware import audit_log_endpoint, encrypt_sensitive_response, require_permission

# BEFORE (existing endpoint):
@app.route('/api/v1/clean-data')
def clean_data():
    return process_data(request.json)

# AFTER (with security - business logic unchanged):
@app.route('/api/v1/clean-data')
@audit_log_endpoint
@encrypt_sensitive_response
@require_permission('data_processor')
def clean_data():
    return process_data(request.json)  # Same code!
```

## Available Decorators

### `@audit_log_endpoint`
Automatically logs all access to the endpoint with user context, timing, and success/failure.

```python
@audit_log_endpoint
@audit_log_endpoint(operation_type="data_processing", sensitivity="high")
```

### `@encrypt_sensitive_response`
Automatically encrypts sensitive fields in response data (SSN, credit cards, etc.).

```python
@encrypt_sensitive_response
@encrypt_sensitive_response(encrypt_fields={"ssn", "credit_card"})
```

### `@require_permission(permission)`
Checks if user has required permission before allowing access.

```python
@require_permission('data_processor')
@require_permission(['admin', 'data_processor'])  # Either permission
@require_permission(Permission.ADMIN)
```

## Pre-built Security Stacks

### `@basic_security()`
Basic audit logging + read permission check.

### `@data_processing_security()`
Enhanced security for data processing: audit + encryption + data processor permission.

### `@admin_security()`
Maximum security for admin operations: critical audit + high encryption + admin permission.

## Usage Examples

```python
# Basic endpoint security
@basic_security()
def get_user_profile():
    return {"name": "John", "email": "john@example.com"}

# Data processing security  
@data_processing_security()
def process_sensitive_data():
    return {"ssn": "123-45-6789"}  # Automatically encrypted

# Admin security
@admin_security()
def delete_user():
    return {"deleted": True}  # Comprehensive logging + encryption
```

## What Happens Automatically

 **Audit Logging**: Every endpoint access logged with user, timing, IP  
 **Response Encryption**: Sensitive data (SSN, credit cards) automatically encrypted  
 **Permission Checking**: User permissions validated before access  
 **Error Logging**: Failed attempts logged with full context  
 **Performance Tracking**: Request duration and performance metrics  
 **Compliance Events**: GDPR/CCPA compliance events tracked  

## Integration

1. **Add decorators to existing endpoints** - no other changes needed
2. **Ensure FastAPI dependencies** - user, db session, request should be available
3. **Configure permissions** - map user roles to permissions in the decorator config

The decorators integrate with your existing:
- Authentication system
- Database models  
- Encryption infrastructure
- Audit logging system

**Zero breaking changes** - your existing code continues to work exactly the same! 
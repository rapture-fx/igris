
# Dependency Optimization Report
Generated: 2025-06-26T13:37:02.758122

## Summary
- **Original Dependencies**: 60 packages
- **Target Dependencies**: 45 packages
- **Final Dependencies**: 24 packages
- **Reduction**: 36 packages (60.0%)

## Size Impact
- **Original Size**: 1880.0 MB
- **Optimized Size**: 130.0 MB
- **Size Reduction**: 1750.0 MB (93.1%)

## Optimization Actions

### Removed Packages (26)
- uvicorn[standard]
- python-jose[cryptography]
- passlib[bcrypt]
- python-decouple
- qrcode[pil]
- phonenumbers
- pycryptodome
- openai
- kafka-python
- openpyxl
- xlrd
- python-magic
- structlog
- isort
- requests
- rq
- google-cloud-storage
- azure-storage-blob
- slack-sdk
- twilio
- fastapi-mail
- Pillow
- PyPDF2
- torchvision
- torchaudio
- bleach

### Moved to ML Service (6)
- scikit-learn
- torch
- transformers
- plotly
- seaborn
- matplotlib

### Moved to Development (4)
- pytest
- pytest-asyncio
- black
- mypy

## Files Created
- `requirements-core.txt` - Core API dependencies (24 packages)
- `requirements-ml.txt` - ML service dependencies (6 packages)
- `requirements-dev.txt` - Development dependencies (4 packages)
- `app/services/ml_service_client.py` - ML service abstraction layer

## Next Steps
1. Test core API functionality with optimized dependencies
2. Set up ML microservice with requirements-ml.txt
3. Update CI/CD to use appropriate requirements files
4. Monitor performance and functionality

## Rollback Instructions
If issues arise, restore original dependencies:
```bash
# Restore original requirements
git checkout HEAD~1 requirements.txt
pip install -r requirements.txt
```

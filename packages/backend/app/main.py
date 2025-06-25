from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
import time
from prometheus_client import Counter, Histogram
import logging
import uuid
from contextlib import asynccontextmanager

from app.core.api_config import settings
from app.core.error_handler import unified_error_handler
# # REMOVED: broken import - analyze_router
from app.api.v1.public.clean import router as clean_router
from app.api.v1.public.validate import router as validate_router
from app.api.v1.public.transform import router as transform_router
from app.api.v1.public.jobs import router as jobs_router
from app.api.v1.public.demo import router as demo_router
from app.api.v1.public.upload import router as upload_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.unified_auth import router as unified_auth_router
from app.api.v1.data_streaming import router as streaming_router
from app.api.v1.billing import router as billing_router
from app.api.v1.admin import router as admin_router
from app.api.v1.monitoring import router as monitoring_router
from app.api.v1.community import router as community_router
from app.api.v1.marketplace import router as marketplace_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.partner import router as partner_router
from app.api.v1.endpoints.data_processing import router as data_processing_router
from app.api.v1.prepare import router as prepare_router
from app.api.v1.semantic_insights import router as semantic_insights_router

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize high-performance data processor
logger.info("🚀 Initializing high-performance unified data processor...")

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    logger.info("Pollarbase API starting up...")
    
    # Initialize high-performance unified data processor
    logger.info("🚀 Initializing high-performance unified data processor...")
    from app.services.unified_data_processor import unified_processor
    logger.info("✅ High-performance data processor ready!")
    
    yield
    logger.info("Pollarbase API shutting down...")

# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Pollarbase API",
        version="1.0.0",
        summary="AI-Powered Data Intelligence Platform",
        description="""
        ## Welcome to Pollarbase API
        
        **Transform your data into actionable insights with cutting-edge AI technology.**
        
        Our comprehensive platform offers:
        
        ###  **Core Features**
        - **AI-Powered Analysis**: Advanced machine learning algorithms for deep data insights
        - **Real-time Processing**: Lightning-fast data processing and analysis
        - **Multi-format Support**: CSV, JSON, Excel, Parquet, and more
        - **Data Cleaning**: Automated data quality improvement and validation
        - **Custom Models**: Deploy and manage your own ML models
        - **Enterprise Security**: Bank-grade security and compliance
        
        ###  **API Categories**
        - **Demo**: Try our features with sample datasets
        - **Public**: Core analysis and processing endpoints  
        - **Upload**: Secure file upload and management
        - **Dashboard**: Analytics and visualization endpoints
        
        ###  **Getting Started**
        1. Explore the **demo** endpoints to understand our capabilities
        2. Upload your data using the **upload** endpoints
        3. Analyze with **public** endpoints for production use
        4. Monitor progress via **dashboard** endpoints
        
        ---
        
        **Need help?** Contact our support team or check our comprehensive documentation.
        """,
        routes=app.routes,
    )
    openapi_schema["info"]["x-logo"] = {
        "url": "https://via.placeholder.com/200x60/3b82f6/white?text=Pollarbase"
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app = FastAPI(
    title="Pollarbase API",
    description="AI Powered data intelligence",
    version="1.0.0",
    docs_url=None,  # Disable default docs
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

app.openapi = custom_openapi

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Custom Swagger UI with elegant styling
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="Comprehensive API documentation for Pollarbase AI Powered data intelligence platform featuring advanced analytics, machine learning, and data processing capabilities.">
        <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
        <link rel="shortcut icon" href="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAyMDAgMjAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0ibG9nb0dyYWRpZW50IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjM2I4MmY2IiAvPjxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjMWQ0ZWQ4IiAvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFlNDBhZiIgLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48Y2lyY2xlIGN4PSIxMDAiIGN5PSI2MCIgcj0iMTIiIGZpbGw9InVybCgjbG9nb0dyYWRpZW50KSIgLz48Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjgiIGZpbGw9InVybCgjbG9nb0dyYWRpZW50KSIgLz48Y2lyY2xlIGN4PSIxMDAiIGN5PSIxNDAiIHI9IjEyIiBmaWxsPSJ1cmwoI2xvZ29HcmFkaWVudCkiIC8+PGNpcmNsZSBjeD0iNjAiIGN5PSI4MCIgcj0iOCIgZmlsbD0idXJsKCNsb2dvR3JhZGllbnQpIiAvPjxjaXJjbGUgY3g9IjE0MCIgY3k9IjgwIiByPSI4IiBmaWxsPSJ1cmwoI2xvZ29HcmFkaWVudCkiIC8+PGNpcmNsZSBjeD0iNjAiIGN5PSIxMjAiIHI9IjgiIGZpbGw9InVybCgjbG9nb0dyYWRpZW50KSIgLz48Y2lyY2xlIGN4PSIxNDAiIGN5PSIxMjAiIHI9IjgiIGZpbGw9InVybCgjbG9nb0dyYWRpZW50KSIgLz48cGF0aCBkPSJNMTAwIDYwIEw2MCA4MCBMMTIwIEwxMDAgMTQwIEwxNDAgMTIwIEwxNDAgODAgWiIgc3Ryb2tlPSJ1cmwoI2xvZ29HcmFkaWVudCkiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIgLz48L3N2Zz4=" />
        <title>API Documentation - Pollarbase AI-Powered Data Intelligence</title>
        <style>
            /* Pollarbase Landing Page Design System */
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
            
            :root {{
                --primary-50: #eff6ff;
                --primary-100: #dbeafe;
                --primary-200: #bfdbfe;
                --primary-300: #93c5fd;
                --primary-400: #60a5fa;
                --primary-500: #3b82f6;
                --primary-600: #2563eb;
                --primary-700: #1d4ed8;
                --primary-800: #1e40af;
                --primary-900: #1e3a8a;
                
                --gray-50: #f8fafc;
                --gray-100: #f1f5f9;
                --gray-200: #e2e8f0;
                --gray-300: #cbd5e1;
                --gray-400: #94a3b8;
                --gray-500: #64748b;
                --gray-600: #475569;
                --gray-700: #334155;
                --gray-800: #1e293b;
                --gray-900: #0f172a;
                
                --success-500: #10b981;
                --success-600: #059669;
                --warning-500: #f59e0b;
                --warning-600: #d97706;
                --error-500: #ef4444;
                --error-600: #dc2626;
                
                --gradient-primary: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%);
                --gradient-subtle: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }}
            
            * {{
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }}
            
            body {{
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: var(--gradient-subtle);
                min-height: 100vh;
                color: var(--gray-800);
                line-height: 1.6;
                font-size: 14px;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }}
            
            /* Pollarbase Header - Matching Landing Page */
            .pollarbase-header {{
                background: var(--gradient-primary);
                color: white;
                padding: 2rem 0;
                box-shadow: var(--shadow-xl);
                position: relative;
                overflow: hidden;
            }}
            
            .pollarbase-header::before {{
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3Cpattern id='grid' width='10' height='10' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 10 0 L 0 0 0 10' fill='none' stroke='rgba(255,255,255,0.1)' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23grid)'/%3E%3C/svg%3E");
                opacity: 0.5;
            }}
            
            .header-container {{
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 2rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
                z-index: 2;
            }}
            
            .pollarbase-brand {{
                display: flex;
                align-items: center;
                gap: 1rem;
            }}
            
            .pollarbase-logo {{
                width: 64px;
                height: 64px;
                filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
            }}
            
            .api-title {{
                font-size: 3rem;
                font-weight: 800;
                background: linear-gradient(45deg, #ffffff, #dbeafe);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 0.25rem;
                line-height: 1.1;
                letter-spacing: -0.025em;
            }}
            
            .api-subtitle {{
                font-size: 1.1rem;
                opacity: 0.9;
                font-weight: 400;
                color: rgba(255, 255, 255, 0.9);
                margin-top: 0.25rem;
            }}
            
            .api-badges {{
                display: flex;
                gap: 0.75rem;
                align-items: center;
            }}
            
            .api-version {{
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(10px);
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 600;
                border: 1px solid rgba(255, 255, 255, 0.2);
                letter-spacing: 0.5px;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }}
            
            .status-indicator {{
                width: 8px;
                height: 8px;
                background: #10b981;
                border-radius: 50%;
                box-shadow: 0 0 4px rgba(16, 185, 129, 0.5);
            }}
            
            /* Main Container - Matching Landing Page */
            .api-main-container {{
                max-width: 1200px;
                margin: -1rem auto 2rem;
                position: relative;
                z-index: 10;
            }}
            
            .swagger-ui {{
                background: white;
                border-radius: 16px;
                box-shadow: var(--shadow-xl);
                overflow: hidden;
                border: 1px solid var(--gray-200);
            }}
            
            /* Navigation Tabs - Matching Landing Page */
            .api-nav {{
                background: var(--gray-50);
                border-bottom: 1px solid var(--gray-200);
                padding: 0 2rem;
                display: flex;
                gap: 0;
                justify-content: flex-start;
                position: sticky;
                top: 0;
                z-index: 100;
                backdrop-filter: blur(10px);
            }}
            
            .nav-tab {{
                padding: 1rem 1.5rem;
                font-weight: 600;
                color: var(--gray-500);
                border-bottom: 3px solid transparent;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 0.875rem;
                text-decoration: none;
                position: relative;
            }}
            
            .nav-tab:hover {{
                color: var(--primary-600);
                background: rgba(59, 130, 246, 0.05);
            }}
            
            .nav-tab.active {{
                color: var(--primary-600);
                border-bottom-color: var(--primary-500);
                background: white;
            }}
            
            .nav-tab::after {{
                content: '';
                position: absolute;
                bottom: -1px;
                left: 50%;
                transform: translateX(-50%);
                width: 0;
                height: 3px;
                background: var(--gradient-primary);
                border-radius: 2px;
                transition: width 0.3s ease;
            }}
            
            .nav-tab:hover::after,
            .nav-tab.active::after {{
                width: 80%;
            }}
            
            /* Quick Stats - Landing Page Style */
            .api-stats {{
                background: var(--gradient-subtle);
                padding: 1.5rem 2rem;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                border-bottom: 1px solid var(--gray-200);
            }}
            
            .stat-card {{
                background: white;
                padding: 1.5rem;
                border-radius: 12px;
                box-shadow: var(--shadow-md);
                border: 1px solid var(--gray-200);
                display: flex;
                align-items: center;
                gap: 1rem;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }}
            
            .stat-card:hover {{
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg);
            }}
            
            .stat-icon {{
                width: 48px;
                height: 48px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                color: white;
            }}
            
            .stat-icon.endpoints {{ background: var(--gradient-primary); }}
            .stat-icon.models {{ background: linear-gradient(135deg, #10b981, #059669); }}
            .stat-icon.uptime {{ background: linear-gradient(135deg, #f59e0b, #d97706); }}
            .stat-icon.version {{ background: linear-gradient(135deg, #8b5cf6, #7c3aed); }}
            
            .stat-content h3 {{
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--gray-800);
                margin-bottom: 0.25rem;
            }}
            
            .stat-content p {{
                font-size: 0.875rem;
                color: var(--gray-500);
                font-weight: 500;
            }}
            
            /* Search and Filter - Landing Page Style */
            .api-controls {{
                padding: 1.5rem 2rem;
                background: white;
                border-bottom: 1px solid var(--gray-200);
                display: flex;
                gap: 1rem;
                align-items: center;
                flex-wrap: wrap;
            }}
            
            .search-container {{
                flex: 1;
                min-width: 300px;
                position: relative;
            }}
            
            .search-input {{
                width: 100%;
                padding: 0.75rem 1rem 0.75rem 2.5rem;
                border: 2px solid var(--gray-200);
                border-radius: 12px;
                font-size: 0.875rem;
                transition: all 0.3s ease;
                background: var(--gray-50);
            }}
            
            .search-input:focus {{
                outline: none;
                border-color: var(--primary-500);
                background: white;
                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
            }}
            
            .search-icon {{
                position: absolute;
                left: 0.75rem;
                top: 50%;
                transform: translateY(-50%);
                color: var(--gray-400);
                font-size: 1.125rem;
            }}
            
            .filter-tags {{
                display: flex;
                gap: 0.5rem;
                flex-wrap: wrap;
            }}
            
            .filter-tag {{
                padding: 0.5rem 1rem;
                background: var(--gray-100);
                color: var(--gray-600);
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 2px solid transparent;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            
            .filter-tag:hover,
            .filter-tag.active {{
                background: var(--primary-500);
                color: white;
                border-color: var(--primary-600);
                transform: translateY(-1px);
                box-shadow: var(--shadow-md);
            }}
            
            /* Content Area */
            .api-content {{
                padding: 2rem;
            }}
            
            /* Enhanced Operation Groups - Landing Page Style */
            .swagger-ui .opblock-tag {{
                background: transparent;
                border: none;
                margin: 2rem 0 1rem 0;
                padding: 0;
                box-shadow: none;
            }}
            
            .swagger-ui .opblock-tag-section h3 {{
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--gray-800);
                margin: 0 0 1rem 0;
                padding: 1.5rem 0 1rem 0;
                border-bottom: 2px solid var(--gray-200);
                position: relative;
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }}
            
            .swagger-ui .opblock-tag-section h3::before {{
                content: '';
                width: 4px;
                height: 24px;
                background: var(--gradient-primary);
                border-radius: 2px;
            }}
            
            .swagger-ui .opblock-tag-section h3::after {{
                content: '';
                position: absolute;
                bottom: -2px;
                left: 0;
                width: 60px;
                height: 2px;
                background: var(--gradient-primary);
                border-radius: 1px;
            }}
            
            /* Enhanced Operation Cards - Landing Page Style */
            .swagger-ui .opblock {{
                background: white;
                border: 2px solid var(--gray-200);
                border-radius: 12px;
                margin: 1rem 0;
                overflow: hidden;
                transition: all 0.3s ease;
                box-shadow: var(--shadow-sm);
            }}
            
            .swagger-ui .opblock:hover {{
                box-shadow: var(--shadow-lg);
                transform: translateY(-2px);
                border-color: var(--gray-300);
            }}
            
            /* HTTP Methods - Enhanced */
            .swagger-ui .opblock.opblock-get {{
                border-left: 4px solid var(--success-500);
            }}
            
            .swagger-ui .opblock.opblock-get .opblock-summary {{
                background: linear-gradient(135deg, var(--success-500), var(--success-600));
                color: white;
            }}
            
            .swagger-ui .opblock.opblock-post {{
                border-left: 4px solid var(--primary-500);
            }}
            
            .swagger-ui .opblock.opblock-post .opblock-summary {{
                background: var(--gradient-primary);
                color: white;
            }}
            
            .swagger-ui .opblock.opblock-put {{
                border-left: 4px solid var(--warning-500);
            }}
            
            .swagger-ui .opblock.opblock-put .opblock-summary {{
                background: linear-gradient(135deg, var(--warning-500), var(--warning-600));
                color: white;
            }}
            
            .swagger-ui .opblock.opblock-delete {{
                border-left: 4px solid var(--error-500);
            }}
            
            .swagger-ui .opblock.opblock-delete .opblock-summary {{
                background: linear-gradient(135deg, var(--error-500), var(--error-600));
                color: white;
            }}
            
            /* Enhanced Operation Summary */
            .swagger-ui .opblock-summary {{
                padding: 1.25rem 1.5rem;
                border: none;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 1rem;
                position: relative;
            }}
            
            .swagger-ui .opblock-summary:hover {{
                filter: brightness(1.05);
            }}
            
            .swagger-ui .opblock-summary-method {{
                font-weight: 800;
                font-size: 0.7rem;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                background: rgba(255, 255, 255, 0.25);
                border: 2px solid rgba(255, 255, 255, 0.3);
                min-width: 60px;
                text-align: center;
                letter-spacing: 1px;
                flex-shrink: 0;
                backdrop-filter: blur(10px);
            }}
            
            .swagger-ui .opblock-summary-path {{
                font-family: 'JetBrains Mono', 'SF Mono', 'Monaco', monospace;
                font-size: 0.875rem;
                font-weight: 600;
                background: rgba(255, 255, 255, 0.2);
                padding: 0.5rem 1rem;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                flex-shrink: 0;
                backdrop-filter: blur(10px);
            }}
            
            .swagger-ui .opblock-summary-description {{
                color: rgba(255, 255, 255, 0.95);
                font-weight: 500;
                font-size: 0.875rem;
                line-height: 1.5;
                flex: 1;
                text-align: left;
                margin: 0 1rem;
            }}
            
            .status-badge {{
                background: rgba(255, 255, 255, 0.25);
                color: white;
                padding: 0.375rem 0.75rem;
                border-radius: 16px;
                font-size: 0.7rem;
                font-weight: 600;
                border: 1px solid rgba(255, 255, 255, 0.3);
                flex-shrink: 0;
                backdrop-filter: blur(10px);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            
            /* Enhanced Expanded Content */
            .swagger-ui .opblock-body {{
                padding: 2rem;
                background: var(--gray-50);
                border-top: 1px solid var(--gray-200);
            }}
            
            /* Enhanced Parameters and Responses */
            .swagger-ui .parameters-container,
            .swagger-ui .responses-wrapper {{
                background: white;
                border-radius: 12px;
                padding: 1.5rem;
                margin: 1rem 0;
                border: 2px solid var(--gray-200);
                box-shadow: var(--shadow-sm);
            }}
            
            /* Enhanced Buttons - Landing Page Style */
            .swagger-ui .btn.try-out__btn {{
                background: var(--gradient-primary);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 0.75rem 1.5rem;
                font-weight: 600;
                font-size: 0.8rem;
                transition: all 0.3s ease;
                box-shadow: var(--shadow-md);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            
            .swagger-ui .btn.try-out__btn:hover {{
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg);
            }}
            
            .swagger-ui .btn.execute {{
                background: linear-gradient(135deg, var(--success-500), var(--success-600));
                color: white;
                border: none;
                border-radius: 8px;
                padding: 1rem 2rem;
                font-weight: 700;
                font-size: 0.8rem;
                transition: all 0.3s ease;
                box-shadow: var(--shadow-md);
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            
            .swagger-ui .btn.execute:hover {{
                transform: translateY(-2px);
                box-shadow: var(--shadow-lg);
            }}
            
            /* Enhanced Form Inputs */
            .swagger-ui input[type="text"],
            .swagger-ui textarea,
            .swagger-ui select {{
                border: 2px solid var(--gray-200);
                border-radius: 8px;
                padding: 0.75rem 1rem;
                font-size: 0.875rem;
                transition: all 0.3s ease;
                background: white;
                font-family: inherit;
            }}
            
            .swagger-ui input[type="text"]:focus,
            .swagger-ui textarea:focus,
            .swagger-ui select:focus {{
                border-color: var(--primary-500);
                outline: none;
                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
            }}
            
            /* Enhanced Code Blocks */
            .swagger-ui .highlight-code {{
                background: var(--gray-900);
                border-radius: 12px;
                border: 2px solid var(--gray-700);
                overflow: hidden;
            }}
            
            /* Responsive Design */
            @media (max-width: 768px) {{
                .header-container {{
                    flex-direction: column;
                    gap: 1rem;
                    text-align: center;
                }}
                
                .api-title {{
                    font-size: 2rem;
                }}
                
                .api-stats {{
                    grid-template-columns: 1fr;
                }}
                
                .api-controls {{
                    flex-direction: column;
                    align-items: stretch;
                }}
                
                .search-container {{
                    min-width: auto;
                }}
            }}
            
            /* Loading Animation */
            @keyframes pulse {{
                0%, 100% {{ opacity: 1; }}
                50% {{ opacity: 0.5; }}
            }}
            
            .loading {{
                animation: pulse 2s infinite;
            }}
            
            /* Success/Error States */
            .success-state {{
                color: var(--success-600);
                background: rgba(16, 185, 129, 0.1);
                border-color: var(--success-500);
            }}
            
            .error-state {{
                color: var(--error-600);
                background: rgba(239, 68, 68, 0.1);
                border-color: var(--error-500);
            }}
        </style>
    </head>
    <body>
        <!-- Pollarbase Header -->
        <div class="pollarbase-header">
            <div class="header-container">
                <div class="pollarbase-brand">
                    <svg class="pollarbase-logo" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#ffffff" />
                                <stop offset="50%" stop-color="#dbeafe" />
                                <stop offset="100%" stop-color="#bfdbfe" />
                            </linearGradient>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge> 
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>
                        <circle cx="100" cy="60" r="8" fill="url(#logoGradient)" filter="url(#glow)" />
                        <circle cx="100" cy="100" r="6" fill="url(#logoGradient)" filter="url(#glow)" />
                        <circle cx="100" cy="140" r="8" fill="url(#logoGradient)" filter="url(#glow)" />
                        <circle cx="60" cy="80" r="6" fill="url(#logoGradient)" filter="url(#glow)" />
                        <circle cx="140" cy="80" r="6" fill="url(#logoGradient)" filter="url(#glow)" />
                        <circle cx="60" cy="120" r="6" fill="url(#logoGradient)" filter="url(#glow)" />
                        <circle cx="140" cy="120" r="6" fill="url(#logoGradient)" filter="url(#glow)" />
                        <path d="M100 60 L60 80 L60 120 L100 140 L140 120 L140 80 Z" stroke="url(#logoGradient)" stroke-width="1.5" fill="none" opacity="0.7" />
                    </svg>
                    <div>
                        <h1 class="api-title">Pollarbase API</h1>
                        <p class="api-subtitle">AI Powered data intelligence</p>
                    </div>
                </div>
                <div class="api-badges">
                    <div class="api-version">
                        <div class="status-indicator"></div>
                        v1.0.0
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Main Container -->
        <div class="api-main-container">
            <div class="swagger-ui">
                <!-- Navigation Tabs -->
                <div class="api-nav">
                    <a href="#/" class="nav-tab active"> Overview</a>
                    <a href="#/operations-tag-Demo" class="nav-tab"> Demo</a>
                    <a href="#/operations-tag-Public" class="nav-tab"> Public API</a>
                    <a href="#/operations-tag-Upload" class="nav-tab"> Upload</a>
                    <a href="#/operations-tag-Dashboard" class="nav-tab"> Dashboard</a>
                    <a href="#/operations-tag-Auth" class="nav-tab"> Auth</a>
                </div>
                
                <!-- Quick Stats -->
                <div class="api-stats">
                    <div class="stat-card">
                        <div class="stat-icon endpoints"></div>
                        <div class="stat-content">
                            <h3>50+</h3>
                            <p>API Endpoints</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon models">AI</div>
                        <div class="stat-content">
                            <h3>25+</h3>
                            <p>AI Models</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon uptime"></div>
                        <div class="stat-content">
                            <h3>99.9%</h3>
                            <p>Uptime</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon version"></div>
                        <div class="stat-content">
                            <h3>Latest</h3>
                            <p>Version 1.0.0</p>
                        </div>
                    </div>
                </div>
                
                <!-- Search and Filter Controls -->
                <div class="api-controls">
                    <div class="search-container">
                        <span class="search-icon">Search</span>
                        <input type="text" class="search-input" placeholder="Search endpoints, methods, or documentation..." />
                    </div>
                    <div class="filter-tags">
                        <span class="filter-tag active">All</span>
                        <span class="filter-tag">GET</span>
                        <span class="filter-tag">POST</span>
                        <span class="filter-tag">PUT</span>
                        <span class="filter-tag">DELETE</span>
                    </div>
                </div>
                
                <!-- Swagger UI Content -->
                <div class="api-content" id="swagger-ui"></div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
        <script>
            const ui = SwaggerUIBundle({{
                url: '/openapi.json',
                dom_id: '#swagger-ui',
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.presets.standalone
                ],
                layout: "BaseLayout",
                deepLinking: true,
                showExtensions: true,
                showCommonExtensions: true,
                docExpansion: "list",
                tryItOutEnabled: true,
                supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
                validatorUrl: null,
                defaultModelsExpandDepth: 1,
                defaultModelExpandDepth: 1,
                displayOperationId: false,
                displayRequestDuration: true,
                showMutatedRequest: true,
                filter: true,
                syntaxHighlight: {{
                    activated: true,
                    theme: "monokai"
                }},
                onComplete: function() {{
                    // Add interactive functionality
                    const searchInput = document.querySelector('.search-input');
                    const filterTags = document.querySelectorAll('.filter-tag');
                    const navTabs = document.querySelectorAll('.nav-tab');
                    
                    // Search functionality
                    if (searchInput) {{
                        searchInput.addEventListener('input', function(e) {{
                            const searchTerm = e.target.value.toLowerCase();
                            const operations = document.querySelectorAll('.opblock');
                            
                            operations.forEach(op => {{
                                const text = op.textContent.toLowerCase();
                                op.style.display = text.includes(searchTerm) ? 'block' : 'none';
                            }});
                        }});
                    }}
                    
                    // Filter tags functionality
                    filterTags.forEach(tag => {{
                        tag.addEventListener('click', function() {{
                            filterTags.forEach(t => t.classList.remove('active'));
                            this.classList.add('active');
                            
                            const method = this.textContent.toLowerCase();
                            const operations = document.querySelectorAll('.opblock');
                            
                            operations.forEach(op => {{
                                if (method === 'all') {{
                                    op.style.display = 'block';
                                }} else {{
                                    const opMethod = op.className.includes(`opblock-${{method}}`);
                                    op.style.display = opMethod ? 'block' : 'none';
                                }}
                            }});
                        }});
                    }});
                    
                    // Navigation tabs functionality
                    navTabs.forEach(tab => {{
                        tab.addEventListener('click', function(e) {{
                            e.preventDefault();
                            navTabs.forEach(t => t.classList.remove('active'));
                            this.classList.add('active');
                            
                            const target = this.getAttribute('href');
                            if (target && target !== '#/') {{
                                const targetElement = document.querySelector(target.replace('#/', '[data-tag="') + '"]');
                                if (targetElement) {{
                                    targetElement.scrollIntoView({{ behavior: 'smooth' }});
                                }}
                            }}
                        }});
                    }});
                }}
            }});
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "*.pollarbase.ai"]
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for demo
    allow_credentials=False,  # Set to False when allowing all origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Metrics middleware
@app.middleware("http")
async def track_metrics(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()
    
    REQUEST_LATENCY.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)
    
    return response

# Enhanced error handling with unified error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler using unified error handling system"""
    try:
        # Use unified error handler for consistent error processing
        error_details = await unified_error_handler.handle_error(
            error=exc,
            request=request,
            component="global_handler"
        )
        
        return unified_error_handler.create_http_response(error_details)
        
    except Exception as handler_error:
        # Fallback to basic error handling if unified handler fails
        logger.critical(f"Unified error handler failed: {handler_error}", exc_info=True)
        logger.error(f"Original error: {exc}", exc_info=True)
        
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "message": "Internal server error",
                    "id": f"fallback_{int(time.time())}",
                    "request_id": getattr(request.state, "request_id", None)
                }
            }
        )

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Pollarbase API",
        "version": "1.0.0",
        "timestamp": time.time()
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Welcome to Pollarbase API",
        "description": "AI Powered data intelligence",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "demo": "/api/v1/demo/features"
    }

# Include routers
app.include_router(demo_router, prefix="/api/v1", tags=["demo"])
# # REMOVED: broken router - analyze_router
app.include_router(clean_router, prefix="/api/v1", tags=["public"])
app.include_router(validate_router, prefix="/api/v1", tags=["public"])
app.include_router(transform_router, prefix="/api/v1", tags=["public"])
app.include_router(jobs_router, prefix="/api/v1", tags=["public"])
app.include_router(upload_router, prefix="/api/v1/upload", tags=["upload"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["dashboard"])
# Unified authentication system (consolidated from 3 systems into 1)
app.include_router(unified_auth_router, prefix="/api/v1", tags=["auth"])

# Advanced streaming data processing
app.include_router(streaming_router, prefix="/api/v1", tags=["streaming"])
app.include_router(billing_router, prefix="/api/v1/billing", tags=["billing"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(monitoring_router, prefix="/api/v1/admin/monitoring", tags=["monitoring"])
app.include_router(community_router, prefix="/api/v1/community", tags=["community"])
app.include_router(marketplace_router, prefix="/api/v1/marketplace", tags=["marketplace"])
app.include_router(integrations_router, prefix="/api/v1/integrations", tags=["integrations"])
app.include_router(partner_router, prefix="/api/v1/partner", tags=["partner"])
app.include_router(data_processing_router, prefix="/api/v1/processing", tags=["data-processing"])

# CORE PRODUCT ENDPOINT - The main value proposition
app.include_router(prepare_router, prefix="/api/v1", tags=["core-preparation"])

# SEMANTIC LAYER - Revenue Insights and Business Intelligence
app.include_router(semantic_insights_router, prefix="/api/v1/insights", tags=["semantic-insights"])

# AI Framework Integration and Advanced Auto-Labeling (Enterprise data preparation features)
try:
    from app.api.v1.ai_framework_endpoints import router as ai_framework_router
    app.include_router(ai_framework_router, prefix="/api/v1/ai-frameworks", tags=["ai-frameworks"])
except ImportError as e:
    logger.warning(f"AI Framework endpoints not available: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    ) 
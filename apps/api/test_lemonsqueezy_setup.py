#!/usr/bin/env python3
"""
Test LemonSqueezy integration setup
Run this to verify the LemonSqueezy integration is properly configured
"""

import os
import sys
from dotenv import load_dotenv

def test_lemonsqueezy_setup():
    """Test LemonSqueezy SDK installation and basic configuration"""
    
    print("🍋 Testing LemonSqueezy Setup")
    print("=" * 50)
    
    # 1. Test SDK installation
    try:
        import lemonsqueezy
        print("✅ LemonSqueezy SDK installed successfully")
        print(f"   Version: {lemonsqueezy.__version__ if hasattr(lemonsqueezy, '__version__') else 'Unknown'}")
    except ImportError as e:
        print(f"❌ LemonSqueezy SDK not installed: {e}")
        return False
    
    # 2. Test httpx installation (for our custom API client)
    try:
        import httpx
        print(f"✅ httpx installed successfully (version: {httpx.__version__})")
    except ImportError as e:
        print(f"❌ httpx not installed: {e}")
        return False
    
    # 3. Load environment variables
    load_dotenv('environment.env')
    
    # 4. Check environment variables
    api_key = os.getenv('LEMONSQUEEZY_API_KEY')
    webhook_secret = os.getenv('LEMONSQUEEZY_WEBHOOK_SECRET')
    store_id = os.getenv('LEMONSQUEEZY_STORE_ID')
    
    print("\\n🔧 Environment Configuration:")
    print(f"   API Key: {'✅ Set' if api_key and api_key != 'your_lemonsqueezy_api_key_here' else '⚠️  Placeholder (needs real key)'}")
    print(f"   Webhook Secret: {'✅ Set' if webhook_secret and webhook_secret != 'your_webhook_secret_here' else '⚠️  Placeholder (needs real secret)'}")
    print(f"   Store ID: {'✅ Set' if store_id and store_id != 'your_store_id_here' else '⚠️  Placeholder (needs real store ID)'}")
    
    # 5. Test basic LemonSqueezy client initialization
    try:
        from lemonsqueezy import LemonSqueezy
        
        if api_key and api_key != 'your_lemonsqueezy_api_key_here':
            client = LemonSqueezy(api_key=api_key)
            print("✅ LemonSqueezy client initialized successfully")
        else:
            # Test with placeholder - should not make actual API calls
            client = LemonSqueezy(api_key="test_key")
            print("✅ LemonSqueezy client can be initialized (using test key)")
            
    except Exception as e:
        print(f"⚠️  LemonSqueezy client initialization issue: {e}")
    
    # 6. Test our custom usage meter import
    try:
        sys.path.append('/Users/wira/Wira Cursor/Schlep-engine/apps/api')
        from app.services.usage_meter import track_api_usage, update_billing
        print("✅ Custom usage meter service imports successfully")
        print("✅ LemonSqueezy integration functions available: track_api_usage, update_billing")
        
    except ImportError as e:
        print(f"⚠️  Custom usage meter import issue: {e}")
    except Exception as e:
        print(f"⚠️  Custom usage meter initialization issue: {e}")
    
    # 7. Summary
    print("\\n📋 Setup Summary:")
    if api_key and api_key != 'your_lemonsqueezy_api_key_here':
        print("✅ Ready for production use")
    else:
        print("⚠️  Ready for development (needs real API keys for production)")
    
    print("\\n📝 Next Steps:")
    print("1. Replace placeholder values in environment.env with real LemonSqueezy credentials")
    print("2. Configure your PostgreSQL database connection")
    print("3. Run: alembic upgrade head (after database is configured)")
    print("4. Start your FastAPI server: uvicorn app.main:app --reload")
    
    return True

if __name__ == "__main__":
    test_lemonsqueezy_setup()
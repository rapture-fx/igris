import aiohttp
import json
from typing import Dict, Any
import logging
from app.core.api_config import settings

logger = logging.getLogger(__name__)

async def send_webhook_notification(
    webhook_url: str,
    payload: Dict[str, Any],
    max_retries: int = 3
) -> bool:
    """
    Send a webhook notification to the specified URL.
    Implements retry logic and error handling.
    """
    headers = {
        "Content-Type": "application/json",
        "User-Agent": f"DataClean-AI/{settings.PROJECT_NAME}"
    }
    
    for attempt in range(max_retries):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    webhook_url,
                    json=payload,
                    headers=headers,
                    timeout=10
                ) as response:
                    if response.status in (200, 201, 202):
                        return True
                    
                    # Log error response
                    error_text = await response.text()
                    logger.error(
                        f"Webhook failed (attempt {attempt + 1}/{max_retries}): "
                        f"Status {response.status}, Response: {error_text}"
                    )
                    
                    if response.status >= 500:
                        # Server error, retry
                        continue
                    else:
                        # Client error, don't retry
                        return False
                        
        except Exception as e:
            logger.error(
                f"Webhook error (attempt {attempt + 1}/{max_retries}): {str(e)}"
            )
            if attempt == max_retries - 1:
                return False
    
    return False 
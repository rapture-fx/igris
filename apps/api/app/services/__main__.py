"""
Entry point for stream services when running as standalone containers
"""

import asyncio
import logging
import os
import sys
from typing import Optional

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.core.logging_config import setup_logging

# Setup logging
setup_logging(
    log_level=os.getenv('LOG_LEVEL', 'INFO'),
    log_file='logs/stream_services.log',
    enable_console=True,
    enable_file=True,
    enable_json=True,
    enable_structured=True
)

logger = logging.getLogger(__name__)

async def run_stream_producers():
    """Run stream producer services"""
    logger.info("Starting stream producer services...")
    
    try:
        from app.services.stream_producers import start_stream_producers, StreamProducerConfig
        from app.core.redis_streams import get_streams_client
        
        # Test Redis connection
        client = await get_streams_client()
        health = await client.health_check()
        
        if health["status"] != "healthy":
            logger.error("Redis is not healthy, cannot start producers")
            return
        
        # Configure producers based on environment variables
        config = {
            "iot": StreamProducerConfig(
                enabled=True,
                rate_per_second=float(os.getenv('IOT_PRODUCER_RATE', '5'))
            ),
            "financial": StreamProducerConfig(
                enabled=True,
                rate_per_second=float(os.getenv('FINANCIAL_PRODUCER_RATE', '20'))
            ),
            "ecommerce": StreamProducerConfig(
                enabled=True,
                rate_per_second=float(os.getenv('ECOMMERCE_PRODUCER_RATE', '50'))
            )
        }
        
        logger.info(f"Starting producers with config: {config}")
        await start_stream_producers(config)
        
    except KeyboardInterrupt:
        logger.info("Received shutdown signal, stopping producers...")
    except Exception as e:
        logger.error(f"Error running stream producers: {e}", exc_info=True)
        raise

async def run_stream_consumers():
    """Run stream consumer services"""
    logger.info("Starting stream consumer services...")
    
    try:
        from app.services.stream_consumers import start_stream_consumers
        from app.services.stream_processing_pipelines import initialize_processing_pipelines
        from app.core.redis_streams import get_streams_client
        
        # Test Redis connection
        client = await get_streams_client()
        health = await client.health_check()
        
        if health["status"] != "healthy":
            logger.error("Redis is not healthy, cannot start consumers")
            return
        
        # Initialize processing pipelines
        initialize_processing_pipelines()
        logger.info("Processing pipelines initialized")
        
        # Start consumers
        await start_stream_consumers()
        
        # Keep the service running
        while True:
            await asyncio.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Received shutdown signal, stopping consumers...")
    except Exception as e:
        logger.error(f"Error running stream consumers: {e}", exc_info=True)
        raise

async def main():
    """Main entry point for stream services"""
    
    # Determine which service to run based on environment variable
    service_mode = os.getenv('STREAM_SERVICE_MODE', 'consumer').lower()
    
    if service_mode == 'producer':
        await run_stream_producers()
    elif service_mode == 'consumer':
        await run_stream_consumers()
    else:
        logger.error(f"Unknown service mode: {service_mode}")
        logger.info("Set STREAM_SERVICE_MODE to 'producer' or 'consumer'")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
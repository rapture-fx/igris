#!/usr/bin/env python3
"""
Health monitoring script for Schlep Engine
Checks service health and sends alerts if issues are detected
"""
import requests
import time
import logging
import os
import json
from datetime import datetime
import smtplib
from email.mime.text import MimeText

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/schlep_health.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class HealthMonitor:
    def __init__(self):
        self.api_url = os.getenv('API_URL', 'http://localhost:8000')
        self.frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        self.alert_email = os.getenv('ALERT_EMAIL', '')
        self.smtp_server = os.getenv('SMTP_SERVER', '')
        self.smtp_user = os.getenv('SMTP_USER', '')
        self.smtp_pass = os.getenv('SMTP_PASS', '')
        
    def check_api_health(self):
        """Check API health endpoint"""
        try:
            response = requests.get(f"{self.api_url}/health", timeout=10)
            if response.status_code == 200:
                health_data = response.json()
                if health_data.get('status') == 'healthy':
                    logger.info("API health check: PASSED")
                    return True, health_data
                else:
                    logger.warning(f"API health check: FAILED - {health_data}")
                    return False, health_data
            else:
                logger.error(f"API health check: HTTP {response.status_code}")
                return False, None
        except Exception as e:
            logger.error(f"API health check: ERROR - {e}")
            return False, str(e)
    
    def check_frontend_health(self):
        """Check frontend availability"""
        try:
            response = requests.get(self.frontend_url, timeout=10)
            if response.status_code == 200:
                logger.info("Frontend health check: PASSED")
                return True, "Frontend accessible"
            else:
                logger.error(f"Frontend health check: HTTP {response.status_code}")
                return False, f"HTTP {response.status_code}"
        except Exception as e:
            logger.error(f"Frontend health check: ERROR - {e}")
            return False, str(e)
    
    def check_database_connectivity(self):
        """Check database through API"""
        try:
            response = requests.get(f"{self.api_url}/api/tasks", timeout=10)
            if response.status_code == 200:
                logger.info("Database connectivity check: PASSED")
                return True, "Database accessible"
            else:
                logger.error(f"Database connectivity check: HTTP {response.status_code}")
                return False, f"HTTP {response.status_code}"
        except Exception as e:
            logger.error(f"Database connectivity check: ERROR - {e}")
            return False, str(e)
    
    def send_alert(self, subject, message):
        """Send email alert"""
        if not all([self.alert_email, self.smtp_server, self.smtp_user, self.smtp_pass]):
            logger.warning("Email alert configuration incomplete, skipping alert")
            return
        
        try:
            msg = MimeText(message)
            msg['Subject'] = subject
            msg['From'] = self.smtp_user
            msg['To'] = self.alert_email
            
            with smtplib.SMTP(self.smtp_server, 587) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_pass)
                server.send_message(msg)
            
            logger.info(f"Alert sent: {subject}")
        except Exception as e:
            logger.error(f"Failed to send alert: {e}")
    
    def run_health_checks(self):
        """Run all health checks"""
        timestamp = datetime.now().isoformat()
        results = {
            'timestamp': timestamp,
            'api': None,
            'frontend': None,
            'database': None,
            'overall_status': 'healthy'
        }
        
        # Check API
        api_healthy, api_data = self.check_api_health()
        results['api'] = {'healthy': api_healthy, 'data': api_data}
        
        # Check Frontend
        frontend_healthy, frontend_data = self.check_frontend_health()
        results['frontend'] = {'healthy': frontend_healthy, 'data': frontend_data}
        
        # Check Database
        db_healthy, db_data = self.check_database_connectivity()
        results['database'] = {'healthy': db_healthy, 'data': db_data}
        
        # Determine overall status
        if not all([api_healthy, frontend_healthy, db_healthy]):
            results['overall_status'] = 'unhealthy'
            
            # Send alert for critical issues
            failed_services = []
            if not api_healthy:
                failed_services.append('API')
            if not frontend_healthy:
                failed_services.append('Frontend')
            if not db_healthy:
                failed_services.append('Database')
            
            alert_subject = f"Schlep Engine Health Alert - {', '.join(failed_services)} DOWN"
            alert_message = f"""
Health check failed at {timestamp}

Failed services: {', '.join(failed_services)}

Details:
- API: {'HEALTHY' if api_healthy else 'FAILED'} - {api_data}
- Frontend: {'HEALTHY' if frontend_healthy else 'FAILED'} - {frontend_data}
- Database: {'HEALTHY' if db_healthy else 'FAILED'} - {db_data}

Please investigate immediately.
            """
            self.send_alert(alert_subject, alert_message)
        
        # Save results to file
        with open('/var/log/schlep_health_status.json', 'w') as f:
            json.dump(results, f, indent=2)
        
        return results

def main():
    """Main monitoring loop"""
    monitor = HealthMonitor()
    
    # Run continuous monitoring if requested
    if os.getenv('CONTINUOUS_MONITORING', '').lower() == 'true':
        interval = int(os.getenv('MONITOR_INTERVAL', '300'))  # 5 minutes default
        logger.info(f"Starting continuous monitoring with {interval}s interval")
        
        while True:
            try:
                results = monitor.run_health_checks()
                logger.info(f"Health check completed - Status: {results['overall_status']}")
                time.sleep(interval)
            except KeyboardInterrupt:
                logger.info("Monitoring stopped by user")
                break
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                time.sleep(60)  # Wait 1 minute before retrying
    else:
        # Single run
        results = monitor.run_health_checks()
        print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
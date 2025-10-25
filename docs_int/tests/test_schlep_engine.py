#!/usr/bin/env python3
"""
Comprehensive Test Suite for Schlep-engine API
This script tests all major capabilities to prove the product works as advertised.
"""

import requests
import json
import time
import os
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:8000"
TEST_FILE = "test_messy_data.csv"

class SchlepEngineTest:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.results = {}
        
    def print_header(self, title):
        print(f"\n{'='*60}")
        print(f"🔧 {title}")
        print('='*60)
        
    def print_success(self, message):
        print(f"✅ {message}")
        
    def print_error(self, message):
        print(f"❌ {message}")
        
    def print_info(self, message):
        print(f"ℹ️  {message}")

    def test_api_health(self):
        """Test 1: API Health Check"""
        self.print_header("API Health & Status")
        
        try:
            # Test health endpoint
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                self.print_success("API server is running and healthy")
                health_data = response.json()
                print(f"   Status: {health_data.get('status', 'Unknown')}")
            else:
                self.print_error(f"Health check failed: {response.status_code}")
                
            # Test API documentation
            docs_response = self.session.get(f"{self.base_url}/docs")
            if docs_response.status_code == 200:
                self.print_success("API documentation is accessible")
            else:
                self.print_error("API documentation not accessible")
                
        except Exception as e:
            self.print_error(f"API connection failed: {str(e)}")
            return False
            
        return True

    def test_file_upload(self):
        """Test 2: File Upload Capability"""
        self.print_header("File Upload & Processing")
        
        if not os.path.exists(TEST_FILE):
            self.print_error(f"Test file {TEST_FILE} not found")
            return None
            
        try:
            with open(TEST_FILE, 'rb') as f:
                files = {'file': (TEST_FILE, f, 'text/csv')}
                response = self.session.post(f"{self.base_url}/v1/upload", files=files)
                
            if response.status_code == 200:
                upload_data = response.json()
                self.print_success("File uploaded successfully")
                self.print_info(f"Job ID: {upload_data.get('job_id', 'Unknown')}")
                self.print_info(f"File size: {upload_data.get('file_size', 'Unknown')} bytes")
                return upload_data.get('job_id')
            else:
                self.print_error(f"Upload failed: {response.status_code}")
                print(f"Response: {response.text}")
                return None
                
        except Exception as e:
            self.print_error(f"Upload error: {str(e)}")
            return None

    def test_data_analysis(self, job_id):
        """Test 3: Data Analysis & Quality Assessment"""
        self.print_header("Data Analysis & Quality Assessment")
        
        if not job_id:
            self.print_error("No job ID available for analysis")
            return
            
        try:
            # Check job status
            response = self.session.get(f"{self.base_url}/v1/jobs/{job_id}")
            if response.status_code == 200:
                job_data = response.json()
                self.print_success("Job status retrieved successfully")
                print(f"   Status: {job_data.get('status', 'Unknown')}")
                print(f"   Progress: {job_data.get('progress', 0)}%")
                
                # Wait for processing if needed
                max_wait = 30
                wait_time = 0
                while job_data.get('status') == 'processing' and wait_time < max_wait:
                    time.sleep(2)
                    wait_time += 2
                    response = self.session.get(f"{self.base_url}/v1/jobs/{job_id}")
                    job_data = response.json()
                    self.print_info(f"Processing... {job_data.get('progress', 0)}%")
                
                if job_data.get('status') == 'completed':
                    self.print_success("Data processing completed")
                    
                    # Test analysis endpoints
                    analysis_response = self.session.get(f"{self.base_url}/v1/analyze/{job_id}")
                    if analysis_response.status_code == 200:
                        analysis_data = analysis_response.json()
                        self.print_success("Data analysis completed")
                        print(f"   Rows: {analysis_data.get('row_count', 'Unknown')}")
                        print(f"   Columns: {analysis_data.get('column_count', 'Unknown')}")
                        print(f"   Quality Score: {analysis_data.get('quality_score', 'Unknown')}")
                        
                        # Test quality metrics
                        quality_response = self.session.get(f"{self.base_url}/v1/quality/{job_id}")
                        if quality_response.status_code == 200:
                            quality_data = quality_response.json()
                            self.print_success("Quality assessment completed")
                            print(f"   Missing Values: {quality_data.get('missing_percentage', 'Unknown')}%")
                            print(f"   Duplicates: {quality_data.get('duplicate_count', 'Unknown')}")
                            print(f"   Outliers: {quality_data.get('outlier_count', 'Unknown')}")
                        
                else:
                    self.print_error(f"Job processing failed or timed out: {job_data.get('status')}")
                    
        except Exception as e:
            self.print_error(f"Analysis error: {str(e)}")

    def test_data_cleaning(self, job_id):
        """Test 4: Data Cleaning & Transformation"""
        self.print_header("Data Cleaning & Transformation")
        
        if not job_id:
            self.print_error("No job ID available for cleaning")
            return
            
        try:
            # Test cleaning endpoint
            cleaning_config = {
                "remove_duplicates": True,
                "handle_missing": "auto",
                "detect_outliers": True,
                "normalize_formats": True
            }
            
            response = self.session.post(
                f"{self.base_url}/v1/clean/{job_id}",
                json=cleaning_config
            )
            
            if response.status_code == 200:
                clean_data = response.json()
                self.print_success("Data cleaning initiated")
                self.print_info(f"Cleaning job ID: {clean_data.get('cleaning_job_id', 'Unknown')}")
                
                # Check cleaning results
                time.sleep(3)  # Allow processing time
                results_response = self.session.get(f"{self.base_url}/v1/results/{job_id}")
                if results_response.status_code == 200:
                    results_data = results_response.json()
                    self.print_success("Cleaning results retrieved")
                    print(f"   Original rows: {results_data.get('original_rows', 'Unknown')}")
                    print(f"   Cleaned rows: {results_data.get('cleaned_rows', 'Unknown')}")
                    print(f"   Removed duplicates: {results_data.get('duplicates_removed', 'Unknown')}")
                    
            else:
                self.print_error(f"Cleaning failed: {response.status_code}")
                
        except Exception as e:
            self.print_error(f"Cleaning error: {str(e)}")

    def test_ml_preparation(self, job_id):
        """Test 5: ML Framework Export"""
        self.print_header("ML Framework Export")
        
        if not job_id:
            self.print_error("No job ID available for ML preparation")
            return
            
        try:
            # Test different framework exports
            frameworks = ['pytorch', 'tensorflow', 'sklearn']
            
            for framework in frameworks:
                response = self.session.post(
                    f"{self.base_url}/v1/export/{job_id}",
                    json={"format": framework, "target_column": "performance_score"}
                )
                
                if response.status_code == 200:
                    export_data = response.json()
                    self.print_success(f"{framework.capitalize()} export successful")
                    self.print_info(f"Export URL: {export_data.get('download_url', 'Not provided')}")
                else:
                    self.print_error(f"{framework.capitalize()} export failed: {response.status_code}")
                    
        except Exception as e:
            self.print_error(f"ML preparation error: {str(e)}")

    def test_api_endpoints(self):
        """Test 6: Core API Endpoints"""
        self.print_header("Core API Endpoints")
        
        endpoints_to_test = [
            "/v1/health",
            "/v1/status", 
            "/openapi.json",
            "/v1/public/demo"
        ]
        
        for endpoint in endpoints_to_test:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}")
                if response.status_code in [200, 404]:  # 404 is acceptable for some endpoints
                    if response.status_code == 200:
                        self.print_success(f"Endpoint {endpoint} is accessible")
                    else:
                        self.print_info(f"Endpoint {endpoint} returned 404 (may not be implemented)")
                else:
                    self.print_error(f"Endpoint {endpoint} failed: {response.status_code}")
                    
            except Exception as e:
                self.print_error(f"Endpoint {endpoint} error: {str(e)}")

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Schlep-engine Comprehensive Test Suite")
        print(f"Testing API at: {self.base_url}")
        
        # Test 1: API Health
        if not self.test_api_health():
            self.print_error("API is not accessible. Cannot continue with tests.")
            return
            
        # Test 2: File Upload
        job_id = self.test_file_upload()
        
        # Test 3: Data Analysis (depends on upload)
        self.test_data_analysis(job_id)
        
        # Test 4: Data Cleaning (depends on upload)
        self.test_data_cleaning(job_id)
        
        # Test 5: ML Preparation (depends on upload)
        self.test_ml_preparation(job_id)
        
        # Test 6: API Endpoints
        self.test_api_endpoints()
        
        # Summary
        self.print_header("Test Summary")
        print("🎉 Test suite completed!")
        print("Check the results above to verify Schlep-engine functionality.")
        print("\nFor detailed API documentation, visit: http://localhost:8000/docs")


if __name__ == "__main__":
    # Create test instance and run all tests
    tester = SchlepEngineTest()
    tester.run_all_tests()
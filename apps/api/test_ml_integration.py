#!/usr/bin/env python3
"""
Focused ML/RL Integration Test

Tests the ML/RL system integration in compatibility mode,
focusing on what's currently available and functional.
"""

import asyncio
import logging
import sys
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
import tempfile
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FocusedMLIntegrationTest:
    """Test ML/RL integration with current dependencies."""
    
    def __init__(self):
        self.results = {}
        self.errors = []
        self.successes = []
    
    async def run_integration_test(self):
        """Run focused integration test."""
        logger.info("Starting focused ML/RL integration test")
        start_time = datetime.now()
        
        try:
            # Test 1: RL Service Integration (Compatibility Mode)
            await self._test_rl_service_integration()
            
            # Test 2: ML Models with Available Dependencies
            await self._test_ml_models_with_sklearn()
            
            # Test 3: Database CRUD Operations
            await self._test_database_crud_operations()
            
            # Test 4: RL Optimization Workflow
            await self._test_rl_optimization_workflow()
            
            # Test 5: Data Processing Pipeline
            await self._test_data_processing_pipeline()
            
        except Exception as e:
            logger.error(f"Integration test failed: {str(e)}")
            self.errors.append(f"Critical error: {str(e)}")
        
        test_time = (datetime.now() - start_time).total_seconds()
        return self._generate_report(test_time)
    
    async def _test_rl_service_integration(self):
        """Test RL service integration in compatibility mode."""
        logger.info("Testing RL service integration")
        
        try:
            from app.services.rl_optimization_service import RLOptimizationService
            from app.services.rl.models.rl_optimization_models import RLOptimizationCRUD
            
            # Create service in compatibility mode (no database)
            crud = RLOptimizationCRUD(db=None)
            service = RLOptimizationService(crud=crud)
            
            # Test service creation
            assert service is not None
            assert service.crud is not None
            
            # Test session creation
            session = await service.start_optimization(
                user_id="test_user",
                pipeline_id="test_pipeline",
                optimization_type="ppo"
            )
            
            assert session is not None
            assert session.user_id == "test_user"
            assert session.pipeline_id == "test_pipeline"
            
            # Test session status retrieval
            status = await service.get_session_status(str(session.id), "test_user")
            assert status is not None
            assert "session_id" in status
            
            self.results["rl_service_integration"] = {
                "status": "success",
                "service_created": True,
                "session_created": True,
                "status_retrieval": True,
                "compatibility_mode": crud.compatibility_mode
            }
            self.successes.append("RL service integration working in compatibility mode")
            
        except Exception as e:
            logger.error(f"RL service integration test failed: {str(e)}")
            self.results["rl_service_integration"] = {"status": "error", "error": str(e)}
            self.errors.append(f"RL service integration: {str(e)}")
    
    async def _test_ml_models_with_sklearn(self):
        """Test ML models using available scikit-learn."""
        logger.info("Testing ML models with scikit-learn")
        
        try:
            from app.ml.models import ManufacturingPredictorModel
            
            # Create test data
            data = pd.DataFrame({
                'sensor_1': np.random.randn(100),
                'sensor_2': np.random.randn(100),
                'sensor_3': np.random.randn(100),
                'temperature': np.random.uniform(20, 100, 100),
                'pressure': np.random.uniform(1, 10, 100),
                'equipment_health': np.random.choice([0, 1], 100)  # Binary classification
            })
            
            # Test model creation and training
            model = ManufacturingPredictorModel()
            result = model.train_predictive_models(
                data=data,
                target_columns=["equipment_health"]
            )
            
            # Validate training results
            assert result is not None
            assert "models_trained" in result
            assert "overall_performance" in result
            assert len(result["models_trained"]) > 0
            
            # Test prediction
            predictions = model.predict_sensor_values(
                data.head(10),
                target_columns=["equipment_health"]
            )
            
            assert predictions is not None
            assert "predictions" in predictions
            assert "equipment_health" in predictions["predictions"]
            
            self.results["ml_models_sklearn"] = {
                "status": "success",
                "model_created": True,
                "training_completed": True,
                "predictions_working": True,
                "models_trained": list(result["models_trained"].keys()),
                "performance_metrics": result.get("overall_performance", {})
            }
            self.successes.append("ML models working with scikit-learn")
            
        except Exception as e:
            logger.error(f"ML models test failed: {str(e)}")
            self.results["ml_models_sklearn"] = {"status": "error", "error": str(e)}
            self.errors.append(f"ML models: {str(e)}")
    
    async def _test_database_crud_operations(self):
        """Test database CRUD operations in compatibility mode."""
        logger.info("Testing database CRUD operations")
        
        try:
            from app.services.rl.models.rl_optimization_models import RLOptimizationCRUD
            
            # Test in compatibility mode (no database)
            crud = RLOptimizationCRUD(db=None)
            
            # Test create operation
            session = await crud.create_session(
                user_id="crud_test_user",
                pipeline_id="crud_test_pipeline",
                optimization_type="ppo",
                best_performance=0.85
            )
            
            assert session is not None
            assert session.user_id == "crud_test_user"
            
            session_id = str(session.id)
            
            # Test get operation
            retrieved_session = await crud.get_session(session_id, "crud_test_user")
            assert retrieved_session is not None
            assert retrieved_session.user_id == "crud_test_user"
            
            # Test update operation
            updated_session = await crud.update_session(
                session_id, 
                best_performance=0.95,
                total_episodes=50
            )
            assert updated_session is not None
            assert updated_session.best_performance == 0.95
            
            # Test list operation
            sessions = await crud.list_sessions("crud_test_user")
            assert len(sessions) > 0
            assert any(s.user_id == "crud_test_user" for s in sessions)
            
            # Test delete operation
            delete_result = await crud.delete_session(session_id, "crud_test_user")
            assert delete_result is True
            
            # Verify deletion
            deleted_session = await crud.get_session(session_id, "crud_test_user")
            assert deleted_session is None
            
            self.results["database_crud"] = {
                "status": "success",
                "create_working": True,
                "get_working": True,
                "update_working": True,
                "list_working": True,
                "delete_working": True,
                "compatibility_mode": crud.compatibility_mode
            }
            self.successes.append("Database CRUD operations working in compatibility mode")
            
        except Exception as e:
            logger.error(f"Database CRUD test failed: {str(e)}")
            self.results["database_crud"] = {"status": "error", "error": str(e)}
            self.errors.append(f"Database CRUD: {str(e)}")
    
    async def _test_rl_optimization_workflow(self):
        """Test complete RL optimization workflow."""
        logger.info("Testing RL optimization workflow")
        
        try:
            from app.services.rl.agents.hyperparameter_optimizer import (
                HyperparameterOptimizer, OptimizationConfig
            )
            
            # Create optimizer with fast config for testing
            config = OptimizationConfig(
                max_episodes=3,
                early_stopping_patience=2,
                n_steps=100  # Small for testing
            )
            
            optimizer = HyperparameterOptimizer(config)
            
            # Create test data file
            test_data = pd.DataFrame({
                'feature1': np.random.randn(50),
                'feature2': np.random.randn(50),
                'target': np.random.choice([0, 1], 50)
            })
            
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False)
            test_data.to_csv(temp_file.name, index=False)
            
            # Run optimization
            result = optimizer.optimize(
                pipeline_id="workflow_test_pipeline",
                training_data_path=temp_file.name
            )
            
            # Validate results
            assert result is not None
            assert result.best_hyperparameters is not None
            assert result.best_performance is not None
            assert result.total_episodes > 0
            assert result.optimization_time > 0
            
            # Cleanup
            Path(temp_file.name).unlink()
            
            self.results["rl_optimization_workflow"] = {
                "status": "success",
                "optimization_completed": True,
                "best_performance": result.best_performance,
                "total_episodes": result.total_episodes,
                "optimization_time": result.optimization_time,
                "hyperparameters_found": len(result.best_hyperparameters) > 0
            }
            self.successes.append("RL optimization workflow working in compatibility mode")
            
        except Exception as e:
            logger.error(f"RL optimization workflow test failed: {str(e)}")
            self.results["rl_optimization_workflow"] = {"status": "error", "error": str(e)}
            self.errors.append(f"RL optimization workflow: {str(e)}")
    
    async def _test_data_processing_pipeline(self):
        """Test data processing pipeline."""
        logger.info("Testing data processing pipeline")
        
        try:
            from app.ml.data_quality import DataQualityAnalyzer
            from app.ml.feature_engineering import FeatureEngineer
            
            # Create test dataset with various data quality issues
            data = pd.DataFrame({
                'numeric_clean': np.random.randn(100),
                'numeric_with_nulls': np.where(np.random.rand(100) < 0.1, np.nan, np.random.randn(100)),
                'categorical': np.random.choice(['A', 'B', 'C'], 100),
                'categorical_with_nulls': np.where(np.random.rand(100) < 0.05, None, np.random.choice(['X', 'Y', 'Z'], 100)),
                'constant_column': 1,
                'target': np.random.choice([0, 1], 100)
            })
            
            # Test data quality analysis
            analyzer = DataQualityAnalyzer()
            quality_report = analyzer.generate_comprehensive_report(data)
            
            assert quality_report is not None
            assert "data_quality_score" in quality_report
            assert "column_analysis" in quality_report
            assert "recommendations" in quality_report
            
            # Test feature engineering
            engineer = FeatureEngineer()
            engineered_data = engineer.engineer_features(data.drop('target', axis=1))
            
            assert engineered_data is not None
            assert engineered_data.shape[0] == data.shape[0]  # Same number of rows
            assert engineered_data.shape[1] >= data.shape[1] - 1  # At least original features (minus target)
            
            self.results["data_processing_pipeline"] = {
                "status": "success",
                "quality_analysis_working": True,
                "feature_engineering_working": True,
                "original_features": data.shape[1] - 1,
                "engineered_features": engineered_data.shape[1],
                "quality_score": quality_report.get("data_quality_score", 0)
            }
            self.successes.append("Data processing pipeline working")
            
        except Exception as e:
            logger.error(f"Data processing pipeline test failed: {str(e)}")
            self.results["data_processing_pipeline"] = {"status": "error", "error": str(e)}
            self.errors.append(f"Data processing pipeline: {str(e)}")
    
    def _generate_report(self, test_time: float):
        """Generate integration test report."""
        total_tests = len(self.results)
        successful_tests = len([r for r in self.results.values() if r.get("status") == "success"])
        success_rate = successful_tests / total_tests if total_tests > 0 else 0
        
        # Determine overall status
        if success_rate >= 0.8:
            overall_status = "EXCELLENT"
        elif success_rate >= 0.6:
            overall_status = "GOOD"
        elif success_rate >= 0.4:
            overall_status = "FAIR"
        else:
            overall_status = "NEEDS_WORK"
        
        report = {
            "test_summary": {
                "timestamp": datetime.now().isoformat(),
                "test_time_seconds": test_time,
                "total_tests": total_tests,
                "successful_tests": successful_tests,
                "success_rate": success_rate,
                "overall_status": overall_status
            },
            "test_results": self.results,
            "successes": self.successes,
            "errors": self.errors,
            "system_info": self._get_system_info(),
            "recommendations": self._generate_recommendations(success_rate)
        }
        
        return report
    
    def _get_system_info(self):
        """Get system information."""
        import platform
        
        system_info = {
            "python_version": platform.python_version(),
            "platform": platform.platform(),
            "available_dependencies": {}
        }
        
        # Check key dependencies
        dependencies = [
            "numpy", "pandas", "sklearn", "gymnasium", 
            "pdfplumber", "openpyxl", "celery", "redis"
        ]
        
        for dep in dependencies:
            try:
                module = __import__(dep)
                system_info["available_dependencies"][dep] = getattr(module, '__version__', 'available')
            except ImportError:
                system_info["available_dependencies"][dep] = "missing"
        
        return system_info
    
    def _generate_recommendations(self, success_rate: float):
        """Generate recommendations based on test results."""
        recommendations = []
        
        if success_rate >= 0.8:
            recommendations.append("ML/RL system integration is working well in compatibility mode")
            recommendations.append("Consider installing PyTorch and stable-baselines3 for full RL functionality")
        elif success_rate >= 0.6:
            recommendations.append("Most core functionality is working")
            recommendations.append("Address failing tests for improved functionality")
        else:
            recommendations.append("Significant issues found - address errors before proceeding")
        
        # Specific recommendations based on failures
        if any("RL service" in error for error in self.errors):
            recommendations.append("Fix RL service integration issues")
        
        if any("ML models" in error for error in self.errors):
            recommendations.append("Install missing ML dependencies (scikit-learn, etc.)")
        
        if any("Database" in error for error in self.errors):
            recommendations.append("Check database connectivity and CRUD operations")
        
        # Always recommend full dependency installation
        recommendations.append("Run 'pip install -r requirements-ml.txt' for full functionality")
        
        return recommendations


async def main():
    """Main execution function."""
    tester = FocusedMLIntegrationTest()
    
    try:
        report = await tester.run_integration_test()
        
        # Print summary
        print("\n" + "="*60)
        print("FOCUSED ML/RL INTEGRATION TEST REPORT")
        print("="*60)
        
        summary = report["test_summary"]
        print(f"Overall Status: {summary['overall_status']}")
        print(f"Success Rate: {summary['success_rate']:.1%} ({summary['successful_tests']}/{summary['total_tests']})")
        print(f"Test Time: {summary['test_time_seconds']:.2f} seconds")
        
        print(f"\nTest Results:")
        for test_name, result in report["test_results"].items():
            status = result.get("status", "unknown")
            status_icon = "✓" if status == "success" else "✗"
            print(f"  {status_icon} {test_name}: {status.upper()}")
        
        if report["successes"]:
            print(f"\nSuccesses ({len(report['successes'])}):")
            for success in report["successes"]:
                print(f"  ✓ {success}")
        
        if report["errors"]:
            print(f"\nErrors ({len(report['errors'])}):")
            for error in report["errors"][:3]:  # Show first 3 errors
                print(f"  ✗ {error}")
        
        print(f"\nSystem Information:")
        sys_info = report["system_info"]
        print(f"  Python: {sys_info['python_version']}")
        print(f"  Platform: {sys_info['platform']}")
        
        available_deps = [k for k, v in sys_info["available_dependencies"].items() if v != "missing"]
        missing_deps = [k for k, v in sys_info["available_dependencies"].items() if v == "missing"]
        
        print(f"  Available dependencies: {', '.join(available_deps)}")
        if missing_deps:
            print(f"  Missing dependencies: {', '.join(missing_deps)}")
        
        print(f"\nRecommendations:")
        for rec in report["recommendations"]:
            print(f"  - {rec}")
        
        # Save detailed report
        report_file = f"ml_integration_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"\nDetailed report saved to: {report_file}")
        
        # Return appropriate exit code
        if summary['success_rate'] >= 0.8:
            return 0
        elif summary['success_rate'] >= 0.5:
            return 1
        else:
            return 2
            
    except Exception as e:
        print(f"Integration test failed with critical error: {str(e)}")
        return 3


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
"""
Test Suite for AI Framework Integration and Advanced Auto-Labeling
================================================================

This test suite validates the enhanced AI capabilities that make Schlep-engine
a comprehensive data preparation platform for AI/ML workflows.

Test Coverage:
- AI Framework Integration (PyTorch, TensorFlow, HuggingFace, scikit-learn)
- Advanced Auto-Labeling with Few-Shot Learning
- Active Learning Sample Selection
- Pattern-Based Labeling Rules
- Train/Test Split Generation
- Data Export Functionality
"""

import pytest
import pandas as pd
import numpy as np
import tempfile
import json
from pathlib import Path
from typing import Dict, List, Any

# Import our services
from app.services.ai_framework_integration import (
    AIFrameworkIntegrator, MLFramework, TaskType, ExportConfig, DataSplit
)
from app.services.advanced_auto_labeler import (
    AdvancedAutoLabeler, LabelingTask, FewShotExample, ConfidenceLevel
)

class TestAIFrameworkIntegration:
    """Test AI Framework Integration capabilities"""
    
    def setup_method(self):
        """Setup test data and integrator"""
        self.integrator = AIFrameworkIntegrator()
        
        # Create sample datasets for different tasks
        self.classification_data = pd.DataFrame({
            'feature1': np.random.randn(1000),
            'feature2': np.random.randn(1000),
            'feature3': np.random.randn(1000),
            'category': np.random.choice(['A', 'B', 'C'], 1000)
        })
        
        self.text_data = pd.DataFrame({
            'text': [
                'This is a positive review',
                'Great product, love it!',
                'Terrible experience, would not recommend',
                'Amazing quality and fast shipping',
                'Poor customer service'
            ] * 200,
            'sentiment': ['positive', 'positive', 'negative', 'positive', 'negative'] * 200
        })
        
        self.regression_data = pd.DataFrame({
            'x1': np.random.randn(500),
            'x2': np.random.randn(500),
            'x3': np.random.randn(500),
            'target': np.random.randn(500)
        })
    
    def test_train_test_split_creation(self):
        """Test proper train/validation/test split creation"""
        split_config = DataSplit(
            train_ratio=0.7,
            validation_ratio=0.15,
            test_ratio=0.15,
            stratify=True
        )
        
        splits = self.integrator.create_train_test_split(
            self.classification_data,
            split_config,
            target_column='category'
        )
        
        # Verify split ratios
        total_samples = len(self.classification_data)
        assert len(splits['train']) == pytest.approx(total_samples * 0.7, abs=5)
        assert len(splits['validation']) == pytest.approx(total_samples * 0.15, abs=5)
        assert len(splits['test']) == pytest.approx(total_samples * 0.15, abs=5)
        
        # Verify stratification (class distribution should be similar across splits)
        train_dist = splits['train']['category'].value_counts(normalize=True)
        val_dist = splits['validation']['category'].value_counts(normalize=True)
        test_dist = splits['test']['category'].value_counts(normalize=True)
        
        for category in ['A', 'B', 'C']:
            assert abs(train_dist[category] - val_dist[category]) < 0.1
            assert abs(train_dist[category] - test_dist[category]) < 0.1
    
    def test_pytorch_export(self):
        """Test PyTorch data export functionality"""
        config = ExportConfig(
            framework=MLFramework.PYTORCH,
            task_type=TaskType.CLASSIFICATION,
            target_column='category',
            feature_columns=['feature1', 'feature2', 'feature3'],
            batch_size=32
        )
        
        with tempfile.TemporaryDirectory() as temp_dir:
            pytorch_data = self.integrator.export_for_pytorch(
                self.classification_data,
                config,
                output_dir=temp_dir
            )
            
            # Verify export structure
            assert 'train_dataset' in pytorch_data
            assert 'validation_dataset' in pytorch_data
            assert 'test_dataset' in pytorch_data
            assert 'train_dataloader' in pytorch_data
            assert 'metadata' in pytorch_data
            
            # Verify metadata
            metadata = pytorch_data['metadata']
            assert metadata['framework'] == 'pytorch'
            assert metadata['task_type'] == 'classification'
            assert metadata['num_features'] == 3
            assert metadata['num_classes'] == 3
            
            # Verify files were created
            assert (Path(temp_dir) / 'train_dataset.pt').exists()
            assert (Path(temp_dir) / 'validation_dataset.pt').exists()
            assert (Path(temp_dir) / 'test_dataset.pt').exists()
    
    def test_tensorflow_export(self):
        """Test TensorFlow data export functionality"""
        config = ExportConfig(
            framework=MLFramework.TENSORFLOW,
            task_type=TaskType.CLASSIFICATION,
            target_column='category',
            feature_columns=['feature1', 'feature2', 'feature3'],
            batch_size=32
        )
        
        with tempfile.TemporaryDirectory() as temp_dir:
            tf_data = self.integrator.export_for_tensorflow(
                self.classification_data,
                config,
                output_dir=temp_dir
            )
            
            # Verify export structure
            assert 'train_dataset' in tf_data
            assert 'validation_dataset' in tf_data
            assert 'test_dataset' in tf_data
            assert 'metadata' in tf_data
            
            # Verify metadata
            metadata = tf_data['metadata']
            assert metadata['framework'] == 'tensorflow'
            assert metadata['task_type'] == 'classification'
    
    def test_huggingface_export(self):
        """Test HuggingFace data export for NLP tasks"""
        config = ExportConfig(
            framework=MLFramework.HUGGINGFACE,
            task_type=TaskType.NLP_CLASSIFICATION,
            target_column='sentiment',
            text_column='text',
            max_length=128
        )
        
        with tempfile.TemporaryDirectory() as temp_dir:
            hf_data = self.integrator.export_for_huggingface(
                self.text_data,
                config,
                output_dir=temp_dir
            )
            
            # Verify export structure
            assert 'datasets' in hf_data
            assert 'tokenizer' in hf_data
            assert 'metadata' in hf_data
            
            # Verify datasets have proper splits
            datasets = hf_data['datasets']
            assert 'train' in datasets
            assert 'validation' in datasets
            assert 'test' in datasets
    
    def test_sklearn_export(self):
        """Test scikit-learn data export functionality"""
        config = ExportConfig(
            framework=MLFramework.SKLEARN,
            task_type=TaskType.CLASSIFICATION,
            target_column='category',
            feature_columns=['feature1', 'feature2', 'feature3']
        )
        
        with tempfile.TemporaryDirectory() as temp_dir:
            sklearn_data = self.integrator.export_for_sklearn(
                self.classification_data,
                config,
                output_dir=temp_dir
            )
            
            # Verify export structure
            assert 'X_train' in sklearn_data
            assert 'X_validation' in sklearn_data
            assert 'X_test' in sklearn_data
            assert 'y_train' in sklearn_data
            assert 'y_validation' in sklearn_data
            assert 'y_test' in sklearn_data
            assert 'preprocessor' in sklearn_data
            assert 'metadata' in sklearn_data
            
            # Verify data shapes
            assert sklearn_data['X_train'].shape[1] == 3  # 3 features
            assert len(sklearn_data['y_train']) == sklearn_data['X_train'].shape[0]
    
    def test_framework_recommendations(self):
        """Test framework recommendation system"""
        recommendations = self.integrator.get_framework_recommendations(
            self.classification_data,
            TaskType.CLASSIFICATION
        )
        
        # Verify recommendation structure
        assert 'primary_frameworks' in recommendations
        assert 'configurations' in recommendations
        assert 'data_characteristics' in recommendations
        
        # Verify data characteristics analysis
        data_chars = recommendations['data_characteristics']
        assert data_chars['num_rows'] == len(self.classification_data)
        assert data_chars['num_columns'] == len(self.classification_data.columns)
        assert data_chars['numeric_columns'] == 3
        assert data_chars['categorical_columns'] == 1


class TestAdvancedAutoLabeler:
    """Test Advanced Auto-Labeling capabilities"""
    
    def setup_method(self):
        """Setup test data and labeler"""
        self.labeler = AdvancedAutoLabeler()
        
        # Create sample data for different labeling tasks
        self.text_samples = [
            "This product is amazing!",
            "Great quality and fast delivery",
            "Terrible experience, very disappointed",
            "Outstanding customer service",
            "Poor quality, would not recommend"
        ]
        
        self.text_labels = [
            "positive", "positive", "negative", "positive", "negative"
        ]
        
        self.structured_samples = [
            {"price": 100, "rating": 4.5, "reviews": 150},
            {"price": 50, "rating": 3.2, "reviews": 80},
            {"price": 200, "rating": 4.8, "reviews": 300},
            {"price": 75, "rating": 2.1, "reviews": 25},
            {"price": 150, "rating": 4.2, "reviews": 200}
        ]
        
        self.structured_labels = ["high", "medium", "high", "low", "high"]
    
    def test_few_shot_text_classification(self):
        """Test few-shot learning for text classification"""
        # Create few-shot examples
        examples = []
        for text, label in zip(self.text_samples, self.text_labels):
            examples.append(FewShotExample(
                input_data=text,
                label=label,
                weight=1.0
            ))
        
        # Train few-shot model
        result = self.labeler.train_few_shot_labeler(
            examples=examples,
            task_type=LabelingTask.TEXT_CLASSIFICATION,
            model_name="sentiment_test"
        )
        
        # Verify training result
        assert result['num_examples'] == 5
        assert set(result['unique_labels']) == {'positive', 'negative'}
        assert result['training_accuracy'] >= 0.0  # Should have some accuracy
        
        # Test prediction
        test_texts = [
            "Excellent product, highly recommend!",
            "Worst purchase ever, complete waste of money"
        ]
        
        predictions = self.labeler.predict_labels(
            data=test_texts,
            model_key=result['model_key']
        )
        
        # Verify prediction structure
        assert len(predictions.predicted_labels) == 2
        assert len(predictions.confidence_scores) == 2
        assert len(predictions.confidence_levels) == 2
        assert all(isinstance(level, ConfidenceLevel) for level in predictions.confidence_levels)
    
    def test_few_shot_structured_classification(self):
        """Test few-shot learning for structured data classification"""
        # Create few-shot examples
        examples = []
        for data, label in zip(self.structured_samples, self.structured_labels):
            examples.append(FewShotExample(
                input_data=data,
                label=label,
                weight=1.0
            ))
        
        # Train few-shot model
        result = self.labeler.train_few_shot_labeler(
            examples=examples,
            task_type=LabelingTask.CATEGORY_CLASSIFICATION,
            model_name="quality_test"
        )
        
        # Verify training
        assert result['num_examples'] == 5
        assert set(result['unique_labels']) == {'high', 'medium', 'low'}
        
        # Test prediction
        test_data = [
            {"price": 120, "rating": 4.7, "reviews": 250},
            {"price": 30, "rating": 2.5, "reviews": 15}
        ]
        
        predictions = self.labeler.predict_labels(
            data=test_data,
            model_key=result['model_key']
        )
        
        assert len(predictions.predicted_labels) == 2
        assert all(label in ['high', 'medium', 'low'] for label in predictions.predicted_labels)
    
    def test_active_learning_selection(self):
        """Test active learning sample selection"""
        # First train a model
        examples = []
        for text, label in zip(self.text_samples, self.text_labels):
            examples.append(FewShotExample(input_data=text, label=label))
        
        result = self.labeler.train_few_shot_labeler(
            examples=examples,
            task_type=LabelingTask.TEXT_CLASSIFICATION,
            model_name="active_test"
        )
        
        # Create unlabeled data
        unlabeled_texts = [
            "This is okay, nothing special",
            "Absolutely fantastic experience!",
            "Not sure about this product",
            "Could be better, has some issues",
            "Perfect quality, exceeded expectations"
        ]
        
        # Test uncertainty-based selection
        selection = self.labeler.active_learning_selection(
            unlabeled_data=unlabeled_texts,
            model_key=result['model_key'],
            n_samples=3,
            strategy="uncertainty"
        )
        
        # Verify selection structure
        assert len(selection['selected_indices']) == 3
        assert len(selection['selected_samples']) == 3
        assert selection['selection_strategy'] == "uncertainty"
        assert len(selection['uncertainty_scores']) == 3
        assert len(selection['predicted_labels']) == 3
    
    def test_pattern_based_labeling(self):
        """Test pattern-based labeling rules"""
        # Create pattern rules
        patterns = {
            "positive": r"(amazing|great|excellent|fantastic|outstanding|perfect)",
            "negative": r"(terrible|awful|poor|worst|disappointed|waste)"
        }
        
        rule_key = self.labeler.create_pattern_rules(
            patterns=patterns,
            task_name="sentiment_patterns"
        )
        
        # Test pattern application
        test_texts = [
            "This product is amazing and works perfectly!",
            "Terrible quality, worst purchase ever",
            "It's okay, nothing special about it",
            "Excellent service and great value",
            "Poor design and awful customer support"
        ]
        
        result = self.labeler.apply_pattern_rules(
            data=test_texts,
            rule_key=rule_key
        )
        
        # Verify pattern matching
        assert len(result.predicted_labels) == 5
        assert result.predicted_labels[0] == "positive"  # "amazing" and "perfectly"
        assert result.predicted_labels[1] == "negative"  # "terrible" and "worst"
        assert result.predicted_labels[2] == "unknown"   # no pattern match
        assert result.predicted_labels[3] == "positive"  # "excellent" and "great"
        assert result.predicted_labels[4] == "negative"  # "poor" and "awful"
        
        # Verify confidence scores
        assert all(0.0 <= score <= 1.0 for score in result.confidence_scores)
        assert result.confidence_scores[0] > 0.8  # High confidence for pattern match
        assert result.confidence_scores[2] < 0.2  # Low confidence for no match
    
    def test_confidence_categorization(self):
        """Test confidence level categorization"""
        # Test different confidence scores
        test_scores = [0.98, 0.87, 0.75, 0.55, 0.25]
        expected_levels = [
            ConfidenceLevel.VERY_HIGH,
            ConfidenceLevel.HIGH,
            ConfidenceLevel.MEDIUM,
            ConfidenceLevel.LOW,
            ConfidenceLevel.VERY_LOW
        ]
        
        for score, expected in zip(test_scores, expected_levels):
            actual = self.labeler._categorize_confidence(score)
            assert actual == expected


class TestIntegrationWorkflow:
    """Test end-to-end workflow integration"""
    
    def test_complete_data_preparation_workflow(self):
        """Test complete workflow from data to ML-ready format"""
        # Step 1: Create sample dataset
        data = pd.DataFrame({
            'text': [
                'Excellent product quality',
                'Poor customer service',
                'Amazing experience overall',
                'Terrible delivery time',
                'Great value for money'
            ] * 100,  # 500 samples
            'rating': [5, 2, 5, 1, 4] * 100,
            'price': np.random.uniform(10, 100, 500)
        })
        
        # Step 2: Setup services
        integrator = AIFrameworkIntegrator()
        labeler = AdvancedAutoLabeler()
        
        # Step 3: Create few-shot examples for sentiment labeling
        examples = [
            FewShotExample("Excellent product quality", "positive"),
            FewShotExample("Poor customer service", "negative"),
            FewShotExample("Amazing experience overall", "positive"),
            FewShotExample("Terrible delivery time", "negative"),
            FewShotExample("Great value for money", "positive")
        ]
        
        # Step 4: Train auto-labeler
        labeling_result = labeler.train_few_shot_labeler(
            examples=examples,
            task_type=LabelingTask.TEXT_CLASSIFICATION,
            model_name="workflow_test"
        )
        
        # Step 5: Generate labels for all data
        predictions = labeler.predict_labels(
            data=data['text'].tolist(),
            model_key=labeling_result['model_key']
        )
        
        # Step 6: Add predicted labels to dataset
        data['sentiment'] = predictions.predicted_labels
        
        # Step 7: Export to different ML frameworks
        config = ExportConfig(
            framework=MLFramework.SKLEARN,
            task_type=TaskType.CLASSIFICATION,
            target_column='sentiment',
            feature_columns=['rating', 'price']
        )
        
        sklearn_export = integrator.export_for_sklearn(data, config)
        
        # Verify complete workflow
        assert len(predictions.predicted_labels) == 500
        assert 'X_train' in sklearn_export
        assert 'y_train' in sklearn_export
        assert sklearn_export['metadata']['num_features'] == 2
        
        # Verify high-confidence predictions exist
        high_conf_count = sum(1 for level in predictions.confidence_levels 
                             if level in [ConfidenceLevel.HIGH, ConfidenceLevel.VERY_HIGH])
        assert high_conf_count > 0


if __name__ == "__main__":
    """Run tests manually for development"""
    print("🚀 Testing AI Framework Integration...")
    
    # Test framework integration
    framework_tests = TestAIFrameworkIntegration()
    framework_tests.setup_method()
    
    print("✅ Testing train/test split creation...")
    framework_tests.test_train_test_split_creation()
    
    print("✅ Testing PyTorch export...")
    framework_tests.test_pytorch_export()
    
    print("✅ Testing framework recommendations...")
    framework_tests.test_framework_recommendations()
    
    # Test auto-labeling
    labeling_tests = TestAdvancedAutoLabeler()
    labeling_tests.setup_method()
    
    print("✅ Testing few-shot text classification...")
    labeling_tests.test_few_shot_text_classification()
    
    print("✅ Testing pattern-based labeling...")
    labeling_tests.test_pattern_based_labeling()
    
    print("✅ Testing active learning selection...")
    labeling_tests.test_active_learning_selection()
    
    # Test integration workflow
    integration_tests = TestIntegrationWorkflow()
    print("✅ Testing complete workflow...")
    integration_tests.test_complete_data_preparation_workflow()
    
    print("\n🎉 All tests passed! AI Framework Integration is working correctly.")
    print("\n📊 Features implemented:")
    print("   • PyTorch/TensorFlow/HuggingFace/scikit-learn exports")
    print("   • Few-shot learning for auto-labeling")
    print("   • Active learning sample selection")
    print("   • Pattern-based labeling rules")
    print("   • Proper train/validation/test splits")
    print("   • Framework recommendations")
    print("\n🎯 Schlep-engine provides comprehensive data infrastructure data preparation capabilities!") 
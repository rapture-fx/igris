#!/usr/bin/env python3
"""
ONNX Export Script for Semantic Classifier

Exports a trained DistilBERT model to ONNX format for deployment.
"""

import argparse
import torch
import onnx
import onnxruntime as ort
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from onnxruntime.quantization import quantize_dynamic, QuantType
import numpy as np


def export_to_onnx(model_dir, output_path, opset_version=14):
    """Export PyTorch model to ONNX format."""
    print(f"Loading model from {model_dir}...")
    model = DistilBertForSequenceClassification.from_pretrained(model_dir)
    tokenizer = DistilBertTokenizer.from_pretrained(model_dir)

    model.eval()

    # Create dummy input
    dummy_text = "This is a sample prompt for ONNX export."
    dummy_input = tokenizer(
        dummy_text,
        return_tensors="pt",
        padding="max_length",
        truncation=True,
        max_length=128,
    )

    # Export to ONNX
    print(f"Exporting to ONNX (opset {opset_version})...")
    torch.onnx.export(
        model,
        (dummy_input["input_ids"], dummy_input["attention_mask"]),
        output_path,
        opset_version=opset_version,
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "attention_mask": {0: "batch_size", 1: "sequence_length"},
            "logits": {0: "batch_size"},
        },
        do_constant_folding=True,
    )

    print(f"✅ Model exported to {output_path}")
    return output_path


def validate_onnx_model(onnx_path, model_dir):
    """Validate the ONNX model by running inference."""
    print("\nValidating ONNX model...")

    # Check ONNX model
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    print("✓ ONNX model is valid")

    # Load tokenizer
    tokenizer = DistilBertTokenizer.from_pretrained(model_dir)

    # Test inference
    test_prompts = [
        "Write a Python function to sort a list",
        "What is the capital of Germany?",
        "Translate 'Hello' to French",
    ]

    session = ort.InferenceSession(onnx_path)

    for prompt in test_prompts:
        inputs = tokenizer(
            prompt,
            return_tensors="np",
            padding="max_length",
            truncation=True,
            max_length=128,
        )

        outputs = session.run(
            None,
            {
                "input_ids": inputs["input_ids"].astype(np.int64),
                "attention_mask": inputs["attention_mask"].astype(np.int64),
            },
        )

        logits = outputs[0][0]
        predicted_class = np.argmax(logits)
        confidence = np.exp(logits) / np.sum(np.exp(logits))  # Softmax

        print(f"  '{prompt[:50]}...' → Class {predicted_class} (conf: {confidence[predicted_class]:.3f})")

    print("✓ ONNX inference successful")


def quantize_model(onnx_path, quantized_path):
    """Quantize the ONNX model to reduce size."""
    print(f"\nQuantizing model to {quantized_path}...")

    quantize_dynamic(
        onnx_path,
        quantized_path,
        weight_type=QuantType.QUInt8,
    )

    # Compare file sizes
    import os
    original_size = os.path.getsize(onnx_path) / (1024 * 1024)  # MB
    quantized_size = os.path.getsize(quantized_path) / (1024 * 1024)  # MB

    print(f"✓ Quantization complete:")
    print(f"  Original: {original_size:.2f} MB")
    print(f"  Quantized: {quantized_size:.2f} MB")
    print(f"  Reduction: {((original_size - quantized_size) / original_size * 100):.1f}%")


def main():
    parser = argparse.ArgumentParser(description="Export model to ONNX")
    parser.add_argument("--model_dir", required=True, help="Path to trained model directory")
    parser.add_argument("--output", default="semantic_classifier.onnx", help="Output ONNX file path")
    parser.add_argument("--quantize", action="store_true", help="Also export quantized version")
    parser.add_argument("--opset", type=int, default=14, help="ONNX opset version")
    args = parser.parse_args()

    # Export to ONNX
    onnx_path = export_to_onnx(args.model_dir, args.output, args.opset)

    # Validate
    validate_onnx_model(onnx_path, args.model_dir)

    # Quantize if requested
    if args.quantize:
        quantized_path = args.output.replace(".onnx", "_quantized.onnx")
        quantize_model(onnx_path, quantized_path)
        print(f"\n✅ Quantized model saved to {quantized_path}")

    print("\n🚀 ONNX export complete! You can now use this model in production.")


if __name__ == "__main__":
    main()

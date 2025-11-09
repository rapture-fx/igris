#!/usr/bin/env python3
"""
Semantic Classification Model Training Script

Trains a DistilBERT model for multi-class semantic classification.
"""

import argparse
import json
import pandas as pd
import torch
from datasets import Dataset
from transformers import (
    DistilBertTokenizer,
    DistilBertForSequenceClassification,
    Trainer,
    TrainingArguments,
)
from sklearn.metrics import accuracy_score, f1_score, classification_report
import numpy as np


# Semantic class labels
CLASS_LABELS = [
    "code_generation",
    "question_answering",
    "translation",
    "summarization",
    "creative_writing",
    "data_analysis",
    "conversational",
    "default",
]

LABEL_TO_ID = {label: idx for idx, label in enumerate(CLASS_LABELS)}
ID_TO_LABEL = {idx: label for idx, label in enumerate(CLASS_LABELS)}


def load_training_data(csv_path):
    """Load and prepare training data from CSV."""
    print(f"Loading training data from {csv_path}...")
    df = pd.read_csv(csv_path)

    # Validate columns
    if "prompt" not in df.columns or "label" not in df.columns:
        raise ValueError("CSV must contain 'prompt' and 'label' columns")

    # Convert labels to IDs
    df["label_id"] = df["label"].map(LABEL_TO_ID)

    # Check for invalid labels
    if df["label_id"].isnull().any():
        invalid_labels = df[df["label_id"].isnull()]["label"].unique()
        raise ValueError(f"Invalid labels found: {invalid_labels}")

    print(f"Loaded {len(df)} examples across {df['label'].nunique()} classes")
    print("\nClass distribution:")
    print(df["label"].value_counts())

    return df


def tokenize_dataset(df, tokenizer, max_length=128):
    """Tokenize the dataset."""
    print(f"\nTokenizing dataset (max_length={max_length})...")

    dataset = Dataset.from_pandas(df[["prompt", "label_id"]])

    def tokenize_function(examples):
        return tokenizer(
            examples["prompt"],
            padding="max_length",
            truncation=True,
            max_length=max_length,
        )

    tokenized = dataset.map(tokenize_function, batched=True)
    tokenized = tokenized.rename_column("label_id", "labels")
    tokenized.set_format("torch", columns=["input_ids", "attention_mask", "labels"])

    return tokenized


def compute_metrics(eval_pred):
    """Compute evaluation metrics."""
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)

    accuracy = accuracy_score(labels, predictions)
    f1 = f1_score(labels, predictions, average="weighted")

    return {
        "accuracy": accuracy,
        "f1": f1,
    }


def train_model(train_dataset, eval_dataset, output_dir="./models/semantic_classifier"):
    """Train the DistilBERT classifier."""
    print("\nInitializing model...")
    model = DistilBertForSequenceClassification.from_pretrained(
        "distilbert-base-uncased",
        num_labels=len(CLASS_LABELS),
    )

    training_args = TrainingArguments(
        output_dir=output_dir,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        learning_rate=2e-5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=16,
        num_train_epochs=3,
        weight_decay=0.01,
        logging_dir=f"{output_dir}/logs",
        logging_steps=100,
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        save_total_limit=2,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        compute_metrics=compute_metrics,
    )

    print("\nStarting training...")
    trainer.train()

    print("\nEvaluating on test set...")
    eval_results = trainer.evaluate(eval_dataset)
    print(f"Test Accuracy: {eval_results['eval_accuracy']:.4f}")
    print(f"Test F1 Score: {eval_results['eval_f1']:.4f}")

    # Detailed classification report
    predictions = trainer.predict(eval_dataset)
    pred_labels = np.argmax(predictions.predictions, axis=-1)
    true_labels = predictions.label_ids

    print("\nClassification Report:")
    print(classification_report(
        true_labels,
        pred_labels,
        target_names=CLASS_LABELS,
        digits=4,
    ))

    # Save model
    print(f"\nSaving model to {output_dir}...")
    model.save_pretrained(output_dir)

    return model, trainer


def main():
    parser = argparse.ArgumentParser(description="Train semantic classification model")
    parser.add_argument("--train_data", required=True, help="Path to training CSV")
    parser.add_argument("--test_data", required=True, help="Path to test CSV")
    parser.add_argument("--output_dir", default="./models/semantic_classifier", help="Output directory")
    parser.add_argument("--max_length", type=int, default=128, help="Max sequence length")
    args = parser.parse_args()

    # Load tokenizer
    tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")

    # Load and tokenize data
    train_df = load_training_data(args.train_data)
    test_df = load_training_data(args.test_data)

    train_dataset = tokenize_dataset(train_df, tokenizer, args.max_length)
    test_dataset = tokenize_dataset(test_df, tokenizer, args.max_length)

    # Train model
    model, trainer = train_model(train_dataset, test_dataset, args.output_dir)

    # Save tokenizer
    tokenizer.save_pretrained(args.output_dir)

    # Save label mapping
    with open(f"{args.output_dir}/label_mapping.json", "w") as f:
        json.dump({
            "label_to_id": LABEL_TO_ID,
            "id_to_label": ID_TO_LABEL,
        }, f, indent=2)

    print(f"\n✅ Training complete! Model saved to {args.output_dir}")


if __name__ == "__main__":
    main()

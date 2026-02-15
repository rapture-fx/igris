#!/usr/bin/env python3
"""
Mock API Server for Testing the Stability Test Framework
Simulates Igris Inertial API responses for demonstration
"""

from flask import Flask, request, jsonify, Response
import time
import random
import json
from datetime import datetime

app = Flask(__name__)

# Stats tracking
stats = {
    'total_requests': 0,
    'successful_requests': 0,
    'failed_requests': 0,
    'providers': {
        'openai': {'requests': 0, 'latency_sum': 0},
        'anthropic': {'requests': 0, 'latency_sum': 0}
    }
}

@app.route('/healthz', methods=['GET'])
def healthz():
    """Liveness probe"""
    return jsonify({"status": "healthy"}), 200

@app.route('/readyz', methods=['GET'])
def readyz():
    """Readiness probe"""
    return jsonify({
        "status": "ready",
        "database": "healthy",
        "redis": "healthy"
    }), 200

@app.route('/metrics', methods=['GET'])
def metrics():
    """Prometheus metrics"""
    metrics_text = f"""# TYPE http_requests_total counter
http_requests_total{{status="200"}} {stats['successful_requests']}
http_requests_total{{status="400"}} 0
http_requests_total{{status="500"}} {stats['failed_requests']}

# TYPE http_request_duration_milliseconds histogram
http_request_duration_milliseconds_bucket{{le="50"}} {int(stats['successful_requests'] * 0.5)}
http_request_duration_milliseconds_bucket{{le="100"}} {int(stats['successful_requests'] * 0.7)}
http_request_duration_milliseconds_bucket{{le="200"}} {int(stats['successful_requests'] * 0.9)}
http_request_duration_milliseconds_bucket{{le="500"}} {int(stats['successful_requests'] * 0.95)}
http_request_duration_milliseconds_bucket{{le="1000"}} {int(stats['successful_requests'] * 0.99)}
http_request_duration_milliseconds_bucket{{le="+Inf"}} {stats['successful_requests']}
"""
    return Response(metrics_text, mimetype='text/plain')

@app.route('/v1/models', methods=['GET'])
def list_models():
    """List available models"""
    return jsonify({
        "data": [
            {"id": "gpt-4", "provider": "openai"},
            {"id": "gpt-3.5-turbo", "provider": "openai"},
            {"id": "claude-3-sonnet", "provider": "anthropic"},
            {"id": "claude-3-opus", "provider": "anthropic"}
        ]
    }), 200

@app.route('/v1/providers/stats', methods=['GET'])
def provider_stats():
    """Provider statistics"""
    return jsonify({
        "providers": [
            {
                "name": "openai",
                "status": "healthy",
                "requests": stats['providers']['openai']['requests'],
                "avg_latency_ms": stats['providers']['openai']['latency_sum'] / max(stats['providers']['openai']['requests'], 1)
            },
            {
                "name": "anthropic",
                "status": "healthy",
                "requests": stats['providers']['anthropic']['requests'],
                "avg_latency_ms": stats['providers']['anthropic']['latency_sum'] / max(stats['providers']['anthropic']['requests'], 1)
            }
        ]
    }), 200

@app.route('/v1/infer', methods=['POST'])
def infer():
    """Main inference endpoint"""
    stats['total_requests'] += 1

    data = request.get_json()

    # Validate request
    if not data or 'model' not in data or 'messages' not in data:
        stats['failed_requests'] += 1
        return jsonify({
            "error": {
                "message": "Missing required fields",
                "type": "invalid_request",
                "code": 400
            }
        }), 400

    # Simulate latency (50-200ms)
    latency = random.uniform(50, 200)
    time.sleep(latency / 1000)

    # Determine provider
    model = data.get('model', 'gpt-4')
    provider = 'openai' if 'gpt' in model.lower() else 'anthropic'

    stats['providers'][provider]['requests'] += 1
    stats['providers'][provider]['latency_sum'] += latency

    # Simulate streaming
    if data.get('stream', False):
        def generate():
            chunks = [
                'data: {"choices":[{"delta":{"content":"This "}}]}\n\n',
                'data: {"choices":[{"delta":{"content":"is "}}]}\n\n',
                'data: {"choices":[{"delta":{"content":"a "}}]}\n\n',
                'data: {"choices":[{"delta":{"content":"test "}}]}\n\n',
                'data: {"choices":[{"delta":{"content":"response"}}]}\n\n',
                'data: {"choices":[{"finish_reason":"stop"}]}\n\n',
                'data: [DONE]\n\n'
            ]
            for chunk in chunks:
                time.sleep(0.05)
                yield chunk

        stats['successful_requests'] += 1
        return Response(generate(), mimetype='text/event-stream')

    # Regular response
    stats['successful_requests'] += 1
    return jsonify({
        "id": f"chatcmpl-{random.randint(1000, 9999)}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "provider": provider,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": f"This is a simulated response from {provider} using {model}. Request processed successfully!"
                },
                "finish_reason": "stop"
            }
        ],
        "usage": {
            "prompt_tokens": 10,
            "completion_tokens": 20,
            "total_tokens": 30
        }
    }), 200

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🚀 MOCK SCHLEP-ENGINE API SERVER")
    print("="*70)
    print(f"Starting on http://localhost:8081")
    print(f"Simulates Igris Inertial API for stability testing")
    print("="*70 + "\n")

    app.run(host='0.0.0.0', port=8081, debug=False)

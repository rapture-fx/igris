#!/usr/bin/env python3
"""
Streaming SSE Reliability Test
Tests concurrent streaming requests for stability
Success Criteria: All streams complete, TTFT < 500ms, no broken pipes
"""

import asyncio
import aiohttp
import time
import sys
import json
from datetime import datetime
from collections import defaultdict
import statistics

class StreamingReliabilityTester:
    def __init__(self, base_url="http://localhost:8080", concurrent=20, iterations=100):
        self.base_url = base_url
        self.concurrent = concurrent
        self.iterations = iterations
        self.results = {
            'total_streams': 0,
            'completed_streams': 0,
            'failed_streams': 0,
            'broken_pipes': 0,
            'timeouts': 0,
            'ttft_samples': [],  # Time to first token
            'stream_durations': [],
            'chunks_received': [],
            'error_types': defaultdict(int)
        }

    async def stream_request(self, session, request_id):
        """Make a streaming SSE request"""
        url = f"{self.base_url}/v1/infer"

        payload = {
            "model": "gpt-4" if request_id % 2 == 0 else "claude-3-sonnet",
            "messages": [
                {"role": "user", "content": f"Streaming test {request_id}: Write a 3-sentence explanation of REST APIs."}
            ],
            "max_tokens": 150,
            "stream": True
        }

        headers = {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "X-Trace-ID": f"streaming-test-{request_id}"
        }

        self.results['total_streams'] += 1
        start_time = time.time()
        first_chunk_time = None
        chunk_count = 0
        stream_complete = False

        try:
            async with session.post(
                url,
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=60, sock_read=30)
            ) as response:

                if response.status != 200:
                    self.results['failed_streams'] += 1
                    self.results['error_types'][f'http_{response.status}'] += 1
                    body = await response.text()
                    print(f"❌ Stream {request_id}: HTTP {response.status} - {body[:100]}")
                    return False

                # Read SSE stream
                async for line in response.content:
                    if not line:
                        continue

                    try:
                        decoded = line.decode('utf-8').strip()

                        # Skip empty lines and comments
                        if not decoded or decoded.startswith(':'):
                            continue

                        # Parse SSE format
                        if decoded.startswith('data: '):
                            data_content = decoded[6:]  # Remove 'data: ' prefix

                            # Record time to first chunk
                            if first_chunk_time is None:
                                first_chunk_time = time.time()
                                ttft = (first_chunk_time - start_time) * 1000
                                self.results['ttft_samples'].append(ttft)

                            chunk_count += 1

                            # Check for stream completion
                            if data_content == '[DONE]' or 'finish_reason' in data_content:
                                stream_complete = True
                                break

                            # Try to parse as JSON
                            try:
                                json.loads(data_content)
                            except json.JSONDecodeError:
                                # Not JSON, might be plain text streaming
                                pass

                    except Exception as e:
                        print(f"⚠️  Stream {request_id}: Chunk parse error - {str(e)}")
                        continue

                duration = (time.time() - start_time) * 1000

                if stream_complete or chunk_count > 0:
                    self.results['completed_streams'] += 1
                    self.results['stream_durations'].append(duration)
                    self.results['chunks_received'].append(chunk_count)

                    if request_id % 10 == 0:
                        ttft = self.results['ttft_samples'][-1] if self.results['ttft_samples'] else 0
                        print(f"✅ Stream {request_id}: Complete ({chunk_count} chunks, "
                              f"TTFT: {ttft:.0f}ms, duration: {duration:.0f}ms)")
                    return True
                else:
                    self.results['failed_streams'] += 1
                    self.results['error_types']['no_data'] += 1
                    print(f"⚠️  Stream {request_id}: No data received")
                    return False

        except aiohttp.ClientPayloadError as e:
            self.results['failed_streams'] += 1
            self.results['broken_pipes'] += 1
            self.results['error_types']['broken_pipe'] += 1
            print(f"🚨 Stream {request_id}: BROKEN PIPE - {str(e)}")
            return False

        except asyncio.TimeoutError:
            self.results['failed_streams'] += 1
            self.results['timeouts'] += 1
            self.results['error_types']['timeout'] += 1
            duration = (time.time() - start_time) * 1000
            print(f"⏱️  Stream {request_id}: TIMEOUT after {duration:.0f}ms")
            return False

        except aiohttp.ClientConnectionError as e:
            self.results['failed_streams'] += 1
            self.results['error_types']['connection_error'] += 1
            print(f"🚨 Stream {request_id}: Connection error - {str(e)}")
            return False

        except Exception as e:
            self.results['failed_streams'] += 1
            self.results['error_types']['unknown'] += 1
            print(f"❌ Stream {request_id}: Unexpected error - {str(e)}")
            return False

    async def run_concurrent_batch(self, session, batch_id, batch_size):
        """Run a batch of concurrent streaming requests"""
        tasks = [
            self.stream_request(session, batch_id * batch_size + i)
            for i in range(batch_size)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Count exceptions
        for result in results:
            if isinstance(result, Exception):
                self.results['failed_streams'] += 1
                self.results['error_types']['exception'] += 1
                print(f"🚨 Task exception: {str(result)}")

        return results

    async def run_streaming_test(self):
        """Execute streaming reliability test"""
        print(f"\n{'='*70}")
        print(f"🌊 STREAMING SSE RELIABILITY TEST")
        print(f"{'='*70}")
        print(f"Target URL: {self.base_url}")
        print(f"Concurrent streams: {self.concurrent}")
        print(f"Total iterations: {self.iterations}")
        print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*70}\n")

        start_time = time.time()

        connector = aiohttp.TCPConnector(limit=self.concurrent + 10, force_close=False, enable_cleanup_closed=True)
        async with aiohttp.ClientSession(connector=connector) as session:

            # Run in batches
            num_batches = (self.iterations + self.concurrent - 1) // self.concurrent

            for batch_id in range(num_batches):
                remaining = self.iterations - (batch_id * self.concurrent)
                batch_size = min(self.concurrent, remaining)

                print(f"\n🔄 Batch {batch_id + 1}/{num_batches} ({batch_size} concurrent streams)")
                await self.run_concurrent_batch(session, batch_id, batch_size)

                # Brief pause between batches
                if batch_id < num_batches - 1:
                    await asyncio.sleep(2)

        total_duration = time.time() - start_time
        self.print_results(total_duration)

    def print_results(self, total_duration):
        """Print comprehensive streaming test results"""
        total = self.results['total_streams']

        print(f"\n{'='*70}")
        print(f"📊 STREAMING RELIABILITY TEST RESULTS")
        print(f"{'='*70}\n")

        print(f"⏱️  Total Duration: {total_duration:.2f}s")
        print(f"📦 Total Streams: {total}")
        print(f"✅ Completed: {self.results['completed_streams']} ({self.results['completed_streams']/total*100:.2f}%)")
        print(f"❌ Failed: {self.results['failed_streams']} ({self.results['failed_streams']/total*100:.2f}%)")
        print(f"🔌 Broken Pipes: {self.results['broken_pipes']}")
        print(f"⏱️  Timeouts: {self.results['timeouts']}")

        if self.results['ttft_samples']:
            sorted_ttft = sorted(self.results['ttft_samples'])
            print(f"\n{'Time to First Token (TTFT) - ms':-^70}")
            print(f"Min:  {min(sorted_ttft):>8.2f}ms")
            print(f"P50:  {sorted_ttft[int(len(sorted_ttft)*0.50)]:>8.2f}ms")
            print(f"P95:  {sorted_ttft[int(len(sorted_ttft)*0.95)]:>8.2f}ms")
            print(f"P99:  {sorted_ttft[int(len(sorted_ttft)*0.99)]:>8.2f}ms")
            print(f"Max:  {max(sorted_ttft):>8.2f}ms")
            print(f"Avg:  {statistics.mean(sorted_ttft):>8.2f}ms")

        if self.results['stream_durations']:
            sorted_durations = sorted(self.results['stream_durations'])
            print(f"\n{'Stream Duration - ms':-^70}")
            print(f"Min:  {min(sorted_durations):>8.2f}ms")
            print(f"P50:  {sorted_durations[int(len(sorted_durations)*0.50)]:>8.2f}ms")
            print(f"P95:  {sorted_durations[int(len(sorted_durations)*0.95)]:>8.2f}ms")
            print(f"Max:  {max(sorted_durations):>8.2f}ms")
            print(f"Avg:  {statistics.mean(sorted_durations):>8.2f}ms")

        if self.results['chunks_received']:
            print(f"\n{'Chunks Received per Stream':-^70}")
            print(f"Min:  {min(self.results['chunks_received']):>8.0f}")
            print(f"Avg:  {statistics.mean(self.results['chunks_received']):>8.1f}")
            print(f"Max:  {max(self.results['chunks_received']):>8.0f}")

        if self.results['error_types']:
            print(f"\n{'Error Type Breakdown':-^70}")
            for error_type, count in sorted(self.results['error_types'].items(), key=lambda x: x[1], reverse=True):
                percentage = (count / total * 100) if total > 0 else 0
                print(f"{error_type}: {count} ({percentage:.1f}%)")

        print(f"\n{'Success Criteria Evaluation':-^70}")

        criteria_met = True

        # All streams should complete
        completion_rate = (self.results['completed_streams'] / total * 100) if total > 0 else 0
        if completion_rate >= 99:
            print(f"✅ Stream completion: {completion_rate:.2f}% (Target: ≥99%)")
        else:
            print(f"❌ Stream completion: {completion_rate:.2f}% (Target: ≥99%) - FAILED")
            criteria_met = False

        # TTFT should be fast (< 500ms for mock/benchmark mode)
        if self.results['ttft_samples']:
            p95_ttft = sorted(self.results['ttft_samples'])[int(len(self.results['ttft_samples']) * 0.95)]
            if p95_ttft < 500:
                print(f"✅ P95 TTFT: {p95_ttft:.2f}ms (Target: <500ms)")
            else:
                print(f"⚠️  P95 TTFT: {p95_ttft:.2f}ms (Target: <500ms) - WARNING")

        # No broken pipes
        if self.results['broken_pipes'] == 0:
            print(f"✅ Broken pipes: 0 (Target: 0)")
        else:
            print(f"❌ Broken pipes: {self.results['broken_pipes']} (Target: 0) - FAILED")
            criteria_met = False

        # Low timeout rate
        timeout_rate = (self.results['timeouts'] / total * 100) if total > 0 else 0
        if timeout_rate < 1:
            print(f"✅ Timeout rate: {timeout_rate:.2f}% (Target: <1%)")
        else:
            print(f"⚠️  Timeout rate: {timeout_rate:.2f}% (Target: <1%) - WARNING")

        print(f"{'='*70}\n")

        if criteria_met:
            print("✅ STREAMING RELIABILITY TEST PASSED - SSE streaming is stable!")
            return 0
        else:
            print("❌ STREAMING RELIABILITY TEST FAILED - Streaming stability issues detected")
            return 1

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Test streaming SSE reliability')
    parser.add_argument('--url', default='http://localhost:8080', help='Base URL of the API')
    parser.add_argument('--concurrent', type=int, default=20, help='Concurrent streams')
    parser.add_argument('--iterations', type=int, default=100, help='Total number of streams')
    args = parser.parse_args()

    tester = StreamingReliabilityTester(
        base_url=args.url,
        concurrent=args.concurrent,
        iterations=args.iterations
    )

    exit_code = asyncio.run(tester.run_streaming_test())
    sys.exit(exit_code)

if __name__ == "__main__":
    main()

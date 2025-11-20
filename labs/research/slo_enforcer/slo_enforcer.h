/* SLO Enforcer FFI C Header
 * For integration with Go via CGO
 */

#ifndef SLO_ENFORCER_H
#define SLO_ENFORCER_H

#ifdef __cplusplus
extern "C" {
#endif

/* FFI Result structure returned by evaluate_and_act */
typedef struct {
    char* json_output;  /* JSON string with evaluation results (must be freed) */
    char* error;        /* Error message if failed (must be freed), NULL on success */
} FFIResult;

/**
 * Evaluate Prometheus metrics and return remediation actions
 *
 * @param metrics_json JSON string containing Prometheus metrics:
 *   {
 *     "p99_latency_ms": 150.0,
 *     "p95_latency_ms": 80.0,
 *     "error_rate": 0.01,
 *     "availability": 0.9999,
 *     "throughput_rps": 10000.0
 *   }
 *
 * @return FFIResult containing:
 *   - json_output: JSON response with { breached: bool, actions: [...] }
 *   - error: Error message (NULL on success)
 *
 * Caller MUST free both json_output and error using free_string()
 */
FFIResult evaluate_and_act(const char* metrics_json);

/**
 * Free a string allocated by this library
 *
 * @param s Pointer to string returned by evaluate_and_act or get_version
 */
void free_string(char* s);

/**
 * Get library version
 *
 * @return Version string (must be freed with free_string)
 */
char* get_version(void);

#ifdef __cplusplus
}
#endif

#endif /* SLO_ENFORCER_H */

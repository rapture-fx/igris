package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Data processing result.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class DataProcessingResult {
    @JsonProperty("job_id")
    private String jobId;

    private String status;

    @JsonProperty("output_path")
    private String outputPath;

    @JsonProperty("records_processed")
    private Long recordsProcessed;

    private Map<String, Object> metadata;

    public DataProcessingResult() {
    }

    public String getJobId() {
        return jobId;
    }

    public DataProcessingResult setJobId(String jobId) {
        this.jobId = jobId;
        return this;
    }

    public String getStatus() {
        return status;
    }

    public DataProcessingResult setStatus(String status) {
        this.status = status;
        return this;
    }

    public String getOutputPath() {
        return outputPath;
    }

    public DataProcessingResult setOutputPath(String outputPath) {
        this.outputPath = outputPath;
        return this;
    }

    public Long getRecordsProcessed() {
        return recordsProcessed;
    }

    public DataProcessingResult setRecordsProcessed(Long recordsProcessed) {
        this.recordsProcessed = recordsProcessed;
        return this;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public DataProcessingResult setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
        return this;
    }

    @Override
    public String toString() {
        return "DataProcessingResult{" +
            "jobId='" + jobId + '\'' +
            ", status='" + status + '\'' +
            ", recordsProcessed=" + recordsProcessed +
            '}';
    }
}
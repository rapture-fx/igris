package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.Map;

/**
 * Training job information.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class TrainingJob {
    @JsonProperty("job_id")
    private String jobId;

    @JsonProperty("pipeline_id")
    private String pipelineId;

    @JsonProperty("model_id")
    private String modelId;

    private String status;

    private Integer progress;

    @JsonProperty("created_at")
    private Date createdAt;

    @JsonProperty("started_at")
    private Date startedAt;

    @JsonProperty("completed_at")
    private Date completedAt;

    private Map<String, Object> metrics;

    private String message;

    public TrainingJob() {
    }

    public String getJobId() {
        return jobId;
    }

    public TrainingJob setJobId(String jobId) {
        this.jobId = jobId;
        return this;
    }

    public String getPipelineId() {
        return pipelineId;
    }

    public TrainingJob setPipelineId(String pipelineId) {
        this.pipelineId = pipelineId;
        return this;
    }

    public String getModelId() {
        return modelId;
    }

    public TrainingJob setModelId(String modelId) {
        this.modelId = modelId;
        return this;
    }

    public String getStatus() {
        return status;
    }

    public TrainingJob setStatus(String status) {
        this.status = status;
        return this;
    }

    public Integer getProgress() {
        return progress;
    }

    public TrainingJob setProgress(Integer progress) {
        this.progress = progress;
        return this;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public TrainingJob setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
        return this;
    }

    public Date getStartedAt() {
        return startedAt;
    }

    public TrainingJob setStartedAt(Date startedAt) {
        this.startedAt = startedAt;
        return this;
    }

    public Date getCompletedAt() {
        return completedAt;
    }

    public TrainingJob setCompletedAt(Date completedAt) {
        this.completedAt = completedAt;
        return this;
    }

    public Map<String, Object> getMetrics() {
        return metrics;
    }

    public TrainingJob setMetrics(Map<String, Object> metrics) {
        this.metrics = metrics;
        return this;
    }

    public String getMessage() {
        return message;
    }

    public TrainingJob setMessage(String message) {
        this.message = message;
        return this;
    }

    @Override
    public String toString() {
        return "TrainingJob{" +
            "jobId='" + jobId + '\'' +
            ", pipelineId='" + pipelineId + '\'' +
            ", status='" + status + '\'' +
            ", progress=" + progress +
            '}';
    }
}
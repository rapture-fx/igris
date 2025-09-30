package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.Map;

/**
 * Information about a processing job.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class JobInfo {
    @JsonProperty("job_id")
    private String jobId;

    private String status;

    @JsonProperty("created_at")
    private Date createdAt;

    @JsonProperty("updated_at")
    private Date updatedAt;

    @JsonProperty("completed_at")
    private Date completedAt;

    private Integer progress;

    private String message;

    private Map<String, Object> metadata;

    public JobInfo() {
    }

    public String getJobId() {
        return jobId;
    }

    public JobInfo setJobId(String jobId) {
        this.jobId = jobId;
        return this;
    }

    public String getStatus() {
        return status;
    }

    public JobInfo setStatus(String status) {
        this.status = status;
        return this;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public JobInfo setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
        return this;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public JobInfo setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
        return this;
    }

    public Date getCompletedAt() {
        return completedAt;
    }

    public JobInfo setCompletedAt(Date completedAt) {
        this.completedAt = completedAt;
        return this;
    }

    public Integer getProgress() {
        return progress;
    }

    public JobInfo setProgress(Integer progress) {
        this.progress = progress;
        return this;
    }

    public String getMessage() {
        return message;
    }

    public JobInfo setMessage(String message) {
        this.message = message;
        return this;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public JobInfo setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
        return this;
    }

    @Override
    public String toString() {
        return "JobInfo{" +
            "jobId='" + jobId + '\'' +
            ", status='" + status + '\'' +
            ", progress=" + progress +
            ", message='" + message + '\'' +
            '}';
    }
}
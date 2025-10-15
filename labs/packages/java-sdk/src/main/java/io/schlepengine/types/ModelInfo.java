package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Date;
import java.util.Map;

/**
 * Machine learning model information.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class ModelInfo {
    @JsonProperty("model_id")
    private String modelId;

    private String name;

    @JsonProperty("model_type")
    private String modelType;

    @JsonProperty("task_type")
    private MLTaskType taskType;

    private String version;

    private String status;

    @JsonProperty("created_at")
    private Date createdAt;

    private Map<String, Object> metrics;

    private Map<String, Object> metadata;

    public ModelInfo() {
    }

    public String getModelId() {
        return modelId;
    }

    public ModelInfo setModelId(String modelId) {
        this.modelId = modelId;
        return this;
    }

    public String getName() {
        return name;
    }

    public ModelInfo setName(String name) {
        this.name = name;
        return this;
    }

    public String getModelType() {
        return modelType;
    }

    public ModelInfo setModelType(String modelType) {
        this.modelType = modelType;
        return this;
    }

    public MLTaskType getTaskType() {
        return taskType;
    }

    public ModelInfo setTaskType(MLTaskType taskType) {
        this.taskType = taskType;
        return this;
    }

    public String getVersion() {
        return version;
    }

    public ModelInfo setVersion(String version) {
        this.version = version;
        return this;
    }

    public String getStatus() {
        return status;
    }

    public ModelInfo setStatus(String status) {
        this.status = status;
        return this;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public ModelInfo setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
        return this;
    }

    public Map<String, Object> getMetrics() {
        return metrics;
    }

    public ModelInfo setMetrics(Map<String, Object> metrics) {
        this.metrics = metrics;
        return this;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public ModelInfo setMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
        return this;
    }

    @Override
    public String toString() {
        return "ModelInfo{" +
            "modelId='" + modelId + '\'' +
            ", name='" + name + '\'' +
            ", modelType='" + modelType + '\'' +
            ", version='" + version + '\'' +
            ", status='" + status + '\'' +
            '}';
    }
}
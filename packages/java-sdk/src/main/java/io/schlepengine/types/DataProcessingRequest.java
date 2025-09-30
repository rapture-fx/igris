package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Data processing request configuration.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class DataProcessingRequest {
    @JsonProperty("source_path")
    private String sourcePath;

    @JsonProperty("source_url")
    private String sourceUrl;

    @JsonProperty("data_format")
    private DataFormat dataFormat;

    @JsonProperty("processing_mode")
    private String processingMode;

    private List<Map<String, Object>> transformations;

    @JsonProperty("output_format")
    private DataFormat outputFormat;

    private Map<String, Object> options;

    public DataProcessingRequest() {
    }

    public String getSourcePath() {
        return sourcePath;
    }

    public DataProcessingRequest setSourcePath(String sourcePath) {
        this.sourcePath = sourcePath;
        return this;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public DataProcessingRequest setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
        return this;
    }

    public DataFormat getDataFormat() {
        return dataFormat;
    }

    public DataProcessingRequest setDataFormat(DataFormat dataFormat) {
        this.dataFormat = dataFormat;
        return this;
    }

    public String getProcessingMode() {
        return processingMode;
    }

    public DataProcessingRequest setProcessingMode(String processingMode) {
        this.processingMode = processingMode;
        return this;
    }

    public List<Map<String, Object>> getTransformations() {
        return transformations;
    }

    public DataProcessingRequest setTransformations(List<Map<String, Object>> transformations) {
        this.transformations = transformations;
        return this;
    }

    public DataFormat getOutputFormat() {
        return outputFormat;
    }

    public DataProcessingRequest setOutputFormat(DataFormat outputFormat) {
        this.outputFormat = outputFormat;
        return this;
    }

    public Map<String, Object> getOptions() {
        return options;
    }

    public DataProcessingRequest setOptions(Map<String, Object> options) {
        this.options = options;
        return this;
    }
}
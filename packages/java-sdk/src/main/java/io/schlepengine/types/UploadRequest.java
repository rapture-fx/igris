package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Request object for uploading data to Schlep-engine.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class UploadRequest {
    @JsonProperty("data")
    private String data;

    /**
     * Default constructor.
     */
    public UploadRequest() {}

    /**
     * Get the data to be uploaded.
     *
     * @return The data
     */
    public String getData() {
        return data;
    }

    /**
     * Set the data to be uploaded.
     *
     * @param data The data to upload
     * @return This request object for method chaining
     */
    public UploadRequest setData(String data) {
        this.data = data;
        return this;
    }

    @Override
    public String toString() {
        return "UploadRequest{" +
                "data='" + data + '\'' +
                '}';
    }
}
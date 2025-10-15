package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * File upload information.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class FileUpload {
    @JsonProperty("file_id")
    private String fileId;

    private String url;

    private String filename;

    @JsonProperty("content_type")
    private String contentType;

    private Long size;

    public FileUpload() {
    }

    public String getFileId() {
        return fileId;
    }

    public FileUpload setFileId(String fileId) {
        this.fileId = fileId;
        return this;
    }

    public String getUrl() {
        return url;
    }

    public FileUpload setUrl(String url) {
        this.url = url;
        return this;
    }

    public String getFilename() {
        return filename;
    }

    public FileUpload setFilename(String filename) {
        this.filename = filename;
        return this;
    }

    public String getContentType() {
        return contentType;
    }

    public FileUpload setContentType(String contentType) {
        this.contentType = contentType;
        return this;
    }

    public Long getSize() {
        return size;
    }

    public FileUpload setSize(Long size) {
        this.size = size;
        return this;
    }

    @Override
    public String toString() {
        return "FileUpload{" +
            "fileId='" + fileId + '\'' +
            ", filename='" + filename + '\'' +
            ", size=" + size +
            '}';
    }
}
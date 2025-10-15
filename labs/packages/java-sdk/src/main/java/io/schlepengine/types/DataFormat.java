package io.schlepengine.types;

/**
 * Data format enumeration.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public enum DataFormat {
    CSV("csv"),
    JSON("json"),
    XLSX("xlsx"),
    PARQUET("parquet"),
    AVRO("avro"),
    ORC("orc");

    private final String value;

    DataFormat(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    @Override
    public String toString() {
        return value;
    }

    public static DataFormat fromString(String text) {
        for (DataFormat format : DataFormat.values()) {
            if (format.value.equalsIgnoreCase(text)) {
                return format;
            }
        }
        throw new IllegalArgumentException("No constant with text " + text + " found");
    }
}
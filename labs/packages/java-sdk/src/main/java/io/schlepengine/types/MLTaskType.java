package io.schlepengine.types;

/**
 * Machine learning task type enumeration.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public enum MLTaskType {
    CLASSIFICATION("classification"),
    REGRESSION("regression"),
    CLUSTERING("clustering"),
    ANOMALY_DETECTION("anomaly_detection"),
    TIME_SERIES("time_series"),
    NLP("nlp"),
    COMPUTER_VISION("computer_vision");

    private final String value;

    MLTaskType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    @Override
    public String toString() {
        return value;
    }

    public static MLTaskType fromString(String text) {
        for (MLTaskType type : MLTaskType.values()) {
            if (type.value.equalsIgnoreCase(text)) {
                return type;
            }
        }
        throw new IllegalArgumentException("No constant with text " + text + " found");
    }
}
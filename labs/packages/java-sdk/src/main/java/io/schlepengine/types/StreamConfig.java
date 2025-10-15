package io.schlepengine.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Configuration for streaming events.
 *
 * @author Schlep-engine Team
 * @version 1.0.0
 * @since 1.0.0
 */
public class StreamConfig {
    @JsonProperty("event_types")
    private List<String> eventTypes = new ArrayList<>();

    @JsonProperty("filters")
    private Map<String, Object> filters = new HashMap<>();

    /**
     * Default constructor.
     */
    public StreamConfig() {}

    /**
     * Get the types of events to subscribe to.
     *
     * @return The event types list
     */
    public List<String> getEventTypes() {
        return eventTypes;
    }

    /**
     * Set the types of events to subscribe to.
     *
     * @param eventTypes The event types list
     * @return This config object for method chaining
     */
    public StreamConfig setEventTypes(List<String> eventTypes) {
        this.eventTypes = eventTypes != null ? eventTypes : new ArrayList<>();
        return this;
    }

    /**
     * Add an event type to subscribe to.
     *
     * @param eventType The event type
     * @return This config object for method chaining
     */
    public StreamConfig addEventType(String eventType) {
        this.eventTypes.add(eventType);
        return this;
    }

    /**
     * Get the optional filters for events.
     *
     * @return The filters map
     */
    public Map<String, Object> getFilters() {
        return filters;
    }

    /**
     * Set the optional filters for events.
     *
     * @param filters The filters map
     * @return This config object for method chaining
     */
    public StreamConfig setFilters(Map<String, Object> filters) {
        this.filters = filters != null ? filters : new HashMap<>();
        return this;
    }

    /**
     * Add a filter for events.
     *
     * @param key The filter key
     * @param value The filter value
     * @return This config object for method chaining
     */
    public StreamConfig addFilter(String key, Object value) {
        this.filters.put(key, value);
        return this;
    }

    @Override
    public String toString() {
        return "StreamConfig{" +
                "eventTypes=" + eventTypes +
                ", filters=" + filters +
                '}';
    }
}
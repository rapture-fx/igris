--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Homebrew)
-- Dumped by pg_dump version 14.18 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: cleanup_old_usage_logs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_usage_logs() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    rows_deleted INTEGER;
BEGIN
    DELETE FROM usage_log
    WHERE timestamp < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS rows_deleted = ROW_COUNT;

    RAISE NOTICE 'Deleted % old usage log rows', rows_deleted;
    RETURN rows_deleted;
END;
$$;


--
-- Name: count_active_devices(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_active_devices(p_license_id uuid) RETURNS integer
    LANGUAGE sql
    AS $$
    SELECT COUNT(*)::INTEGER
    FROM devices
    WHERE license_id = p_license_id
    AND status = 'active'
    AND last_seen > NOW() - INTERVAL '1 hour';
$$;


--
-- Name: current_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_tenant_id() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('app.current_tenant', true);
END;
$$;


--
-- Name: get_agent_config(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_agent_config(p_agent_id character varying) RETURNS TABLE(version bigint, config_data jsonb, requires_restart boolean)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_fleet_id VARCHAR(255);
BEGIN
    -- Get fleet_id for this agent
    SELECT fleet_id INTO v_fleet_id
    FROM fleet_agents
    WHERE agent_id = p_agent_id;

    IF v_fleet_id IS NULL THEN
        RAISE EXCEPTION 'Agent not found: %', p_agent_id;
    END IF;

    -- Return agent-specific config if exists, otherwise fleet config, otherwise global
    RETURN QUERY
    SELECT fc.version, fc.config_data, fc.requires_restart
    FROM fleet_configs fc
    WHERE (fc.agent_id = p_agent_id OR fc.fleet_id = v_fleet_id OR fc.fleet_id IS NULL)
    ORDER BY
        CASE
            WHEN fc.agent_id = p_agent_id THEN 1
            WHEN fc.fleet_id = v_fleet_id THEN 2
            ELSE 3
        END,
        fc.version DESC
    LIMIT 1;
END;
$$;


--
-- Name: FUNCTION get_agent_config(p_agent_id character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_agent_config(p_agent_id character varying) IS 'Retrieve the latest configuration for an agent';


--
-- Name: get_monthly_cloud_requests(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_monthly_cloud_requests(p_license_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    SELECT COUNT(*)::INTEGER
    FROM usage_log
    WHERE license_id = p_license_id
    AND request_type = 'cloud'
    AND timestamp >= DATE_TRUNC('month', NOW())
    AND timestamp < DATE_TRUNC('month', NOW()) + INTERVAL '1 month';
$$;


--
-- Name: get_monthly_requests_by_provider(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_monthly_requests_by_provider(p_license_id uuid) RETURNS TABLE(provider character varying, request_count bigint)
    LANGUAGE sql STABLE
    AS $$
    SELECT provider, COUNT(*)
    FROM usage_log
    WHERE license_id = p_license_id
    AND request_type = 'cloud'
    AND timestamp >= DATE_TRUNC('month', NOW())
    AND timestamp < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    GROUP BY provider
    ORDER BY COUNT(*) DESC;
$$;


--
-- Name: get_quota_usage_percentage(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_quota_usage_percentage(p_license_id uuid, p_quota_limit integer) RETURNS numeric
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    current_usage INTEGER;
    usage_percent DECIMAL(5,2);
BEGIN
    -- Get current month usage
    SELECT get_monthly_cloud_requests(p_license_id) INTO current_usage;

    -- Calculate percentage (handle unlimited quota as -1)
    IF p_quota_limit = -1 THEN
        RETURN 0.0; -- Unlimited
    ELSIF p_quota_limit = 0 THEN
        RETURN 100.0; -- No quota
    ELSE
        usage_percent := (current_usage::DECIMAL / p_quota_limit::DECIMAL) * 100;
        RETURN LEAST(usage_percent, 100.0);
    END IF;
END;
$$;


--
-- Name: log_tier_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_tier_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.tier IS DISTINCT FROM NEW.tier THEN
        INSERT INTO tier_change_log (tenant_id, old_tier, new_tier, source)
        VALUES (NEW.tenant_id, OLD.tier, NEW.tier, 'trigger');
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: mark_inactive_devices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_inactive_devices() RETURNS integer
    LANGUAGE sql
    AS $$
    UPDATE devices
    SET status = 'inactive'
    WHERE status = 'active'
    AND last_seen < NOW() - INTERVAL '1 hour'
    RETURNING 1;
$$;


--
-- Name: record_fleet_telemetry(character varying, character varying, bigint, numeric, bigint, integer, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_fleet_telemetry(p_agent_id character varying, p_health character varying, p_uptime_secs bigint, p_cpu_usage numeric, p_memory_usage_mb bigint, p_active_tasks integer, p_metrics jsonb DEFAULT NULL::jsonb, p_logs jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_telemetry_id UUID;
    v_fleet_id VARCHAR(255);
BEGIN
    -- Get fleet_id for this agent
    SELECT fleet_id INTO v_fleet_id
    FROM fleet_agents
    WHERE agent_id = p_agent_id;

    -- Insert telemetry record
    INSERT INTO fleet_telemetry (
        agent_id, fleet_id, health_status, uptime_secs,
        cpu_usage_percent, memory_usage_mb, active_tasks,
        metrics, logs
    ) VALUES (
        p_agent_id, v_fleet_id, p_health, p_uptime_secs,
        p_cpu_usage, p_memory_usage_mb, p_active_tasks,
        p_metrics, p_logs
    ) RETURNING id INTO v_telemetry_id;

    -- Update agent heartbeat
    PERFORM update_agent_heartbeat(
        p_agent_id, p_health, p_uptime_secs,
        p_cpu_usage, p_memory_usage_mb, p_active_tasks
    );

    RETURN v_telemetry_id;
END;
$$;


--
-- Name: FUNCTION record_fleet_telemetry(p_agent_id character varying, p_health character varying, p_uptime_secs bigint, p_cpu_usage numeric, p_memory_usage_mb bigint, p_active_tasks integer, p_metrics jsonb, p_logs jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_fleet_telemetry(p_agent_id character varying, p_health character varying, p_uptime_secs bigint, p_cpu_usage numeric, p_memory_usage_mb bigint, p_active_tasks integer, p_metrics jsonb, p_logs jsonb) IS 'Record telemetry data from an agent';


--
-- Name: register_fleet_agent(character varying, character varying, character varying, character varying, jsonb, character varying, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_fleet_agent(p_agent_id character varying, p_hostname character varying, p_platform character varying, p_version character varying, p_capabilities jsonb, p_location character varying DEFAULT NULL::character varying, p_metadata jsonb DEFAULT NULL::jsonb) RETURNS TABLE(fleet_id character varying, config_version bigint)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_fleet_id VARCHAR(255);
    v_config_version BIGINT;
BEGIN
    -- Generate fleet_id from agent_id (simple grouping: first 8 chars)
    -- In production, this could be more sophisticated
    v_fleet_id := 'fleet-default';

    -- Insert or update agent
    INSERT INTO fleet_agents (
        agent_id, fleet_id, hostname, platform, version,
        capabilities, location, metadata, status, health, last_seen
    ) VALUES (
        p_agent_id, v_fleet_id, p_hostname, p_platform, p_version,
        p_capabilities, p_location, p_metadata, 'active', 'healthy', NOW()
    )
    ON CONFLICT (agent_id) DO UPDATE SET
        hostname = EXCLUDED.hostname,
        platform = EXCLUDED.platform,
        version = EXCLUDED.version,
        capabilities = EXCLUDED.capabilities,
        location = EXCLUDED.location,
        metadata = EXCLUDED.metadata,
        status = 'active',
        last_seen = NOW(),
        updated_at = NOW();

    -- Get latest config version for this fleet
    SELECT COALESCE(MAX(fc.version), 0) INTO v_config_version
    FROM fleet_configs fc
    WHERE fc.fleet_id = v_fleet_id OR fc.fleet_id IS NULL;

    -- Update agent's config version
    UPDATE fleet_agents
    SET config_version = v_config_version
    WHERE agent_id = p_agent_id;

    -- Log registration event
    INSERT INTO fleet_events (agent_id, fleet_id, event_type, severity, message)
    VALUES (p_agent_id, v_fleet_id, 'registration', 'info', 'Agent registered successfully');

    RETURN QUERY SELECT v_fleet_id, v_config_version;
END;
$$;


--
-- Name: FUNCTION register_fleet_agent(p_agent_id character varying, p_hostname character varying, p_platform character varying, p_version character varying, p_capabilities jsonb, p_location character varying, p_metadata jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.register_fleet_agent(p_agent_id character varying, p_hostname character varying, p_platform character varying, p_version character varying, p_capabilities jsonb, p_location character varying, p_metadata jsonb) IS 'Register or update a fleet agent and return fleet_id and config_version';


--
-- Name: set_tenant_context(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_tenant_context(p_tenant_id text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM set_config('app.current_tenant', p_tenant_id, true);
END;
$$;


--
-- Name: sync_task_record_proof_state_from_lineage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_task_record_proof_state_from_lineage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.execution_id IS NULL OR NEW.execution_id = '' OR NEW.tenant_id IS NULL OR NEW.tenant_id = '' THEN
        RETURN NEW;
    END IF;

    UPDATE task_records
    SET proof_stored_hash = NEW.receipt_hash,
        proof_signature = NEW.signature,
        proof_status = CASE
            WHEN COALESCE(task_records.proof_expected_hash, '') = '' THEN 'present'
            WHEN task_records.proof_expected_hash = NEW.receipt_hash THEN 'verified'
            ELSE 'mismatch'
        END,
        proof_checked_at = NOW()
    WHERE task_records.tenant_id = NEW.tenant_id
      AND task_records.proof_execution_id = NEW.execution_id;

    RETURN NEW;
END;
$$;


--
-- Name: update_agent_heartbeat(character varying, character varying, bigint, numeric, bigint, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_agent_heartbeat(p_agent_id character varying, p_health character varying, p_uptime_secs bigint, p_cpu_usage numeric, p_memory_usage_mb bigint, p_active_tasks integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Update last_seen and health status
    UPDATE fleet_agents
    SET last_seen = NOW(),
        health = p_health,
        status = 'active',
        updated_at = NOW()
    WHERE agent_id = p_agent_id;

    -- If agent not found, log warning event
    IF NOT FOUND THEN
        INSERT INTO fleet_events (agent_id, event_type, severity, message)
        VALUES (p_agent_id, 'heartbeat', 'warning', 'Heartbeat from unregistered agent');
    END IF;
END;
$$;


--
-- Name: FUNCTION update_agent_heartbeat(p_agent_id character varying, p_health character varying, p_uptime_secs bigint, p_cpu_usage numeric, p_memory_usage_mb bigint, p_active_tasks integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_agent_heartbeat(p_agent_id character varying, p_health character varying, p_uptime_secs bigint, p_cpu_usage numeric, p_memory_usage_mb bigint, p_active_tasks integer) IS 'Update agent last_seen timestamp and health status';


--
-- Name: update_fleet_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_fleet_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp without time zone,
    "refreshTokenExpiresAt" timestamp without time zone,
    scope text,
    password text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: action_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    target_type text NOT NULL,
    target_url text DEFAULT ''::text NOT NULL,
    method text DEFAULT 'POST'::text NOT NULL,
    policy_preset text DEFAULT 'Safe automation'::text NOT NULL,
    replay_class text DEFAULT 'retryable'::text NOT NULL,
    approval_required boolean DEFAULT false NOT NULL,
    irreversible boolean DEFAULT false NOT NULL,
    secret_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    target_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    fallback_policy jsonb DEFAULT '{"enabled": false}'::jsonb NOT NULL
);


--
-- Name: action_policy_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_policy_decisions (
    decision_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid,
    agent_id text,
    runtime_id text,
    task_type text NOT NULL,
    action_name text NOT NULL,
    environment_label text,
    resource_scope text,
    risk_level text NOT NULL,
    decision text NOT NULL,
    replay_class text NOT NULL,
    irreversible boolean DEFAULT false NOT NULL,
    human_gated boolean DEFAULT false NOT NULL,
    policy_version text NOT NULL,
    policy_reason text NOT NULL,
    action_digest text NOT NULL,
    boundary_digest text,
    checkpoint_portability text DEFAULT 'same_runtime_only'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT action_policy_decisions_checkpoint_portability_check CHECK ((checkpoint_portability = ANY (ARRAY['same_runtime_only'::text, 'compatible_runtime'::text, 'any_runtime'::text]))),
    CONSTRAINT action_policy_decisions_decision_check CHECK ((decision = ANY (ARRAY['allowed'::text, 'denied'::text, 'approval_required'::text]))),
    CONSTRAINT action_policy_decisions_replay_class_check CHECK ((replay_class = ANY (ARRAY['retryable'::text, 'non_retryable'::text]))),
    CONSTRAINT action_policy_decisions_risk_level_check CHECK ((risk_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: agent_blackboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_blackboard (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    key text NOT NULL,
    value jsonb DEFAULT 'null'::jsonb NOT NULL,
    ttl_seconds integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agent_evidence_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_evidence_memory (
    memory_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid,
    execution_id text DEFAULT ''::text NOT NULL,
    registered_agent_id uuid,
    registered_agent_name text DEFAULT ''::text NOT NULL,
    goal_summary text NOT NULL,
    decision_summary text NOT NULL,
    evidence_summary jsonb DEFAULT '[]'::jsonb NOT NULL,
    outcome_summary text NOT NULL,
    redaction_status text DEFAULT 'redacted'::text NOT NULL,
    retention_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_evidence_memory_attachment_check CHECK (((task_id IS NOT NULL) OR (execution_id <> ''::text) OR (registered_agent_id IS NOT NULL) OR (registered_agent_name <> ''::text))),
    CONSTRAINT agent_evidence_memory_evidence_summary_array_check CHECK ((jsonb_typeof(evidence_summary) = 'array'::text)),
    CONSTRAINT agent_evidence_memory_redaction_status_check CHECK ((redaction_status = ANY (ARRAY['redacted'::text, 'rejected'::text, 'manual_review'::text])))
);


--
-- Name: agent_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_settings (
    agent_id text NOT NULL,
    tenant_id text NOT NULL,
    shadow_mode boolean DEFAULT false NOT NULL,
    policy_hash text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reflection_mode boolean DEFAULT false NOT NULL,
    council_mode boolean DEFAULT false NOT NULL,
    cognitive_advisor_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: ai_capability_decision_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_capability_decision_audit (
    envelope_id text NOT NULL,
    task_id uuid NOT NULL,
    tenant_id text NOT NULL,
    runtime_id text,
    capability text NOT NULL,
    permit boolean NOT NULL,
    reason text NOT NULL,
    policy_version text NOT NULL,
    credential_ref_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    persisted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_capability_policy_lifecycle_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_capability_policy_lifecycle_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    policy_version text NOT NULL,
    action text NOT NULL,
    actor_id text NOT NULL,
    actor_email text,
    signer_identity text NOT NULL,
    signer_key_version text,
    command_nonce text,
    command_hash text,
    command_signature text,
    previous_status text,
    new_status text NOT NULL,
    policy_snapshot jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_capability_policy_lifecycle_audit_action_check CHECK ((action = ANY (ARRAY['draft'::text, 'update'::text, 'activate'::text, 'expire'::text, 'revoke'::text])))
);


--
-- Name: ai_capability_policy_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_capability_policy_settings (
    tenant_id text NOT NULL,
    policy_version text DEFAULT 'capabilities-policy.v1'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    active boolean DEFAULT false NOT NULL,
    policy jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    updated_by text,
    revoked_by text,
    activated_at timestamp with time zone,
    expired_at timestamp with time zone,
    revoked_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_capability_policy_settings_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'expired'::text, 'revoked'::text])))
);


--
-- Name: ai_credential_ref_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_credential_ref_audit (
    reference_id text NOT NULL,
    envelope_id text NOT NULL,
    task_id uuid NOT NULL,
    tenant_id text NOT NULL,
    tool text,
    capability text,
    scope text,
    expires_at_unix_ms bigint NOT NULL,
    revocable boolean NOT NULL,
    revoked_at timestamp with time zone,
    persisted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_task_permission_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_task_permission_audit (
    envelope_id text NOT NULL,
    task_id uuid NOT NULL,
    tenant_id text NOT NULL,
    runtime_id text,
    agent_id text,
    principal_id text,
    acting_on_behalf_of text,
    required_capabilities jsonb NOT NULL,
    credential_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    permission_envelope jsonb NOT NULL,
    envelope_hash text NOT NULL,
    envelope_signature text NOT NULL,
    signer_key_version text,
    issued_at_unix_ms bigint NOT NULL,
    expires_at_unix_ms bigint NOT NULL,
    persisted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_tool_receipt_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_tool_receipt_audit (
    task_id uuid NOT NULL,
    tenant_id text NOT NULL,
    runtime_id text,
    execution_id text NOT NULL,
    envelope_id text,
    capability text,
    tool_name text NOT NULL,
    tool_action_hash text,
    routing_decision text NOT NULL,
    request_hash text,
    response_hash text,
    receipt_hash text,
    receipt_signature text,
    envelope_signature text,
    violation_occurred boolean DEFAULT false NOT NULL,
    violation text,
    execution_envelope jsonb NOT NULL,
    execution_receipt jsonb,
    persisted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_requests (
    approval_id uuid DEFAULT gen_random_uuid() NOT NULL,
    decision_id uuid NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_reason text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by text,
    decided_at timestamp with time zone,
    decision_reason text,
    CONSTRAINT approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text, 'canceled'::text])))
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying(255) DEFAULT 'default'::character varying NOT NULL,
    event_type character varying(50) NOT NULL,
    event_category character varying(50) DEFAULT 'general'::character varying NOT NULL,
    severity character varying(20) DEFAULT 'info'::character varying NOT NULL,
    provider character varying(50),
    model character varying(100),
    action character varying(50),
    cost_usd numeric(12,6),
    tokens_requested integer,
    tokens_allowed integer,
    request_id character varying(255),
    trace_id character varying(255),
    metadata jsonb,
    error_message text,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: boundary_violations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boundary_violations (
    violation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid,
    runtime_id text,
    boundary_id uuid,
    violation_type text NOT NULL,
    severity text NOT NULL,
    reason text NOT NULL,
    evidence_digest text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT boundary_violations_severity_check CHECK ((severity = ANY (ARRAY['info'::text, 'warning'::text, 'error'::text, 'critical'::text])))
);


--
-- Name: bt_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bt_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text,
    nodes jsonb DEFAULT '[]'::jsonb NOT NULL,
    edges jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: circuit_breaker_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.circuit_breaker_states (
    id bigint NOT NULL,
    tenant_id text NOT NULL,
    provider text NOT NULL,
    state text DEFAULT 'closed'::text NOT NULL,
    trip_count integer DEFAULT 0 NOT NULL,
    failure_count integer DEFAULT 0 NOT NULL,
    last_tripped_at timestamp with time zone,
    last_success_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: circuit_breaker_states_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.circuit_breaker_states_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: circuit_breaker_states_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.circuit_breaker_states_id_seq OWNED BY public.circuit_breaker_states.id;


--
-- Name: council_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.council_results (
    id bigint NOT NULL,
    tenant_id text DEFAULT 'system'::text NOT NULL,
    providers_used text[] DEFAULT '{}'::text[] NOT NULL,
    chairman_provider text DEFAULT ''::text NOT NULL,
    winner_provider text DEFAULT ''::text NOT NULL,
    response_count integer DEFAULT 0 NOT NULL,
    total_latency_ms bigint DEFAULT 0 NOT NULL,
    ranking_latency_ms bigint DEFAULT 0 NOT NULL,
    synthesis_latency_ms bigint DEFAULT 0 NOT NULL,
    council_cost_usd double precision DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: council_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.council_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: council_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.council_results_id_seq OWNED BY public.council_results.id;


--
-- Name: device_containment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_containment (
    id bigint NOT NULL,
    device_id text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    mode text DEFAULT 'cgroup'::text NOT NULL,
    violation_count bigint DEFAULT 0 NOT NULL,
    cpu_quota text,
    memory_limit text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: device_containment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_containment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: device_containment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_containment_id_seq OWNED BY public.device_containment.id;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    license_id uuid NOT NULL,
    device_id character varying(128) NOT NULL,
    hostname character varying(255),
    platform character varying(64),
    runtime_version character varying(32),
    first_seen timestamp without time zone DEFAULT now() NOT NULL,
    last_seen timestamp without time zone DEFAULT now() NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    metadata jsonb
);


--
-- Name: TABLE devices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.devices IS 'Devices registered under each license for tracking and enforcement';


--
-- Name: COLUMN devices.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.devices.status IS 'Device status: active (heartbeat within 1 hour), inactive (no recent heartbeat)';


--
-- Name: execution_boundaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_boundaries (
    boundary_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid,
    runtime_id text,
    policy_decision_id uuid,
    environment_label text,
    allowed_tools jsonb DEFAULT '[]'::jsonb NOT NULL,
    denied_tools jsonb DEFAULT '[]'::jsonb NOT NULL,
    network_scope text DEFAULT 'none'::text NOT NULL,
    filesystem_scope text DEFAULT 'none'::text NOT NULL,
    api_scope text DEFAULT 'none'::text NOT NULL,
    resource_limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    runtime_capabilities jsonb DEFAULT '{}'::jsonb NOT NULL,
    boundary_digest text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: execution_context; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_context (
    execution_id text NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid,
    runtime_id text,
    runtime_label text,
    provider text,
    route_decision text,
    execution_path text,
    fallback_used boolean DEFAULT false NOT NULL,
    fallback_reason text,
    policy_snapshot jsonb,
    capability_snapshot jsonb,
    events jsonb DEFAULT '[]'::jsonb NOT NULL,
    logs jsonb DEFAULT '[]'::jsonb NOT NULL,
    verification_status text,
    receipt_id text,
    receipt_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT execution_context_tenant_id_not_empty CHECK ((tenant_id <> ''::text))
);


--
-- Name: TABLE execution_context; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.execution_context IS 'Verified execution context linked to execution_lineage rows. Stores route, provider, policy/capability snapshots, and lifecycle events for console run detail views without altering the receipt ledger.';


--
-- Name: execution_eval_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_eval_runs (
    eval_run_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    eval_id uuid NOT NULL,
    task_id uuid NOT NULL,
    execution_id text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    passed_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    results_json jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT execution_eval_runs_failed_count_check CHECK ((failed_count >= 0)),
    CONSTRAINT execution_eval_runs_passed_count_check CHECK ((passed_count >= 0)),
    CONSTRAINT execution_eval_runs_results_json_check CHECK ((jsonb_typeof(results_json) = 'array'::text)),
    CONSTRAINT execution_eval_runs_status_check CHECK ((status = ANY (ARRAY['passed'::text, 'failed'::text])))
);


--
-- Name: execution_evals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_evals (
    eval_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    target_action_name text DEFAULT ''::text NOT NULL,
    target_agent_id text DEFAULT ''::text NOT NULL,
    assertions_json jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT execution_evals_assertions_json_check CHECK ((jsonb_typeof(assertions_json) = 'array'::text))
);


--
-- Name: execution_input_ref_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_input_ref_audit (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid,
    action_id uuid,
    input_ref_id uuid,
    purpose text NOT NULL,
    actor_type text DEFAULT 'system'::text NOT NULL,
    event_type text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    success boolean DEFAULT false NOT NULL,
    failure_code text DEFAULT ''::text NOT NULL,
    key_version text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: execution_input_refs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_input_refs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid,
    action_id uuid,
    purpose text NOT NULL,
    ciphertext bytea NOT NULL,
    nonce bytea NOT NULL,
    aad jsonb DEFAULT '{}'::jsonb NOT NULL,
    digest_sha256 text NOT NULL,
    plaintext_bytes integer NOT NULL,
    content_type text,
    redaction_policy_version text NOT NULL,
    key_version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    last_decrypted_at timestamp with time zone
);


--
-- Name: execution_lineage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_lineage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id text NOT NULL,
    transaction_id text DEFAULT ''::text NOT NULL,
    transaction_hash text DEFAULT ''::text NOT NULL,
    agent_id text NOT NULL,
    cpu_time_ms bigint DEFAULT 0 NOT NULL,
    wall_time_ms bigint DEFAULT 0 NOT NULL,
    memory_peak_mb bigint DEFAULT 0 NOT NULL,
    fs_bytes_written bigint DEFAULT 0 NOT NULL,
    tool_calls integer DEFAULT 0 NOT NULL,
    violation_occurred boolean DEFAULT false NOT NULL,
    receipt_hash text NOT NULL,
    previous_hash text DEFAULT ''::text NOT NULL,
    signature text NOT NULL,
    runtime_id text,
    tenant_id text NOT NULL,
    timestamp_utc timestamp with time zone NOT NULL,
    persisted_at timestamp with time zone DEFAULT now() NOT NULL,
    alert_acknowledged_at timestamp with time zone,
    alert_resolved_at timestamp with time zone,
    status text,
    violation_details jsonb,
    alert_escalated_at timestamp with time zone,
    pause_reason text,
    approved_by text,
    approved_at timestamp with time zone,
    shadow_run_id text,
    prompt_preview text,
    CONSTRAINT execution_lineage_tenant_id_not_empty CHECK ((tenant_id <> ''::text))
);


--
-- Name: TABLE execution_lineage; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.execution_lineage IS 'Append-only, cryptographically-verified execution receipts forwarded from igris-runtime instances. Records are written only after Ed25519 signature verification. Provides the audit trail linking SDK requests to runtime resource consumption via transaction_id → ExecutionTransaction.';


--
-- Name: federated_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.federated_config (
    id bigint NOT NULL,
    tenant_id text DEFAULT 'default'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    min_participants integer DEFAULT 3 NOT NULL,
    privacy_budget double precision DEFAULT 1.0 NOT NULL,
    noise_scale double precision DEFAULT 0.1 NOT NULL,
    round_interval_mins integer DEFAULT 60 NOT NULL,
    max_rounds_per_day integer DEFAULT 12 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: federated_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.federated_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: federated_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.federated_config_id_seq OWNED BY public.federated_config.id;


--
-- Name: federated_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.federated_participants (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    tenant_id text DEFAULT 'default'::text NOT NULL,
    device_id text NOT NULL,
    hostname text,
    status text DEFAULT 'idle'::text NOT NULL,
    updates_count integer DEFAULT 0 NOT NULL,
    model_version text DEFAULT 'v1.0'::text NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: federated_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.federated_rounds (
    id bigint NOT NULL,
    tenant_id text DEFAULT 'default'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    participant_count integer DEFAULT 0 NOT NULL,
    updates_received integer DEFAULT 0 NOT NULL,
    aggregation_loss double precision,
    model_version text DEFAULT 'v1.0'::text NOT NULL
);


--
-- Name: federated_rounds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.federated_rounds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: federated_rounds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.federated_rounds_id_seq OWNED BY public.federated_rounds.id;


--
-- Name: fleet_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleet_agents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    agent_id character varying(255) NOT NULL,
    fleet_id character varying(255) NOT NULL,
    hostname character varying(255),
    platform character varying(50),
    version character varying(50),
    endpoint character varying(255),
    location character varying(255),
    capabilities jsonb,
    metadata jsonb,
    status character varying(50) DEFAULT 'active'::character varying,
    health character varying(50) DEFAULT 'unknown'::character varying,
    last_seen timestamp without time zone DEFAULT now(),
    config_version bigint DEFAULT 0,
    assigned_role character varying(100),
    registered_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE fleet_agents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fleet_agents IS 'Registry of all Igris Runtime instances in the fleet';


--
-- Name: fleet_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleet_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    fleet_id character varying(255),
    agent_id character varying(255),
    version bigint NOT NULL,
    config_data jsonb NOT NULL,
    description text,
    requires_restart boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    created_by character varying(255)
);


--
-- Name: TABLE fleet_configs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fleet_configs IS 'Configuration versions for fleet management';


--
-- Name: fleet_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleet_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    agent_id character varying(255),
    fleet_id character varying(255),
    event_type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    message text,
    metadata jsonb,
    error_message text,
    "timestamp" timestamp without time zone DEFAULT now()
);


--
-- Name: TABLE fleet_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fleet_events IS 'Audit trail for fleet management operations';


--
-- Name: fleet_telemetry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fleet_telemetry (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    agent_id character varying(255) NOT NULL,
    fleet_id character varying(255),
    "timestamp" timestamp without time zone DEFAULT now(),
    received_at timestamp without time zone DEFAULT now(),
    health_status character varying(50),
    uptime_secs bigint,
    cpu_usage_percent numeric(5,2),
    memory_usage_mb bigint,
    active_tasks integer,
    metrics jsonb,
    logs jsonb
);


--
-- Name: TABLE fleet_telemetry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fleet_telemetry IS 'Telemetry data collected from fleet agents';


--
-- Name: licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    license_key character varying(64) NOT NULL,
    tier character varying(20) NOT NULL,
    customer_email character varying(255) NOT NULL,
    customer_id uuid,
    devices_limit integer NOT NULL,
    status character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone,
    metadata jsonb,
    tenant_id text
);

ALTER TABLE ONLY public.licenses FORCE ROW LEVEL SECURITY;


--
-- Name: TABLE licenses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.licenses IS 'Software licenses for igris-runtime with tier-based access control';


--
-- Name: COLUMN licenses.tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.licenses.tier IS 'License tier: seed (free, 1 device), horizon ($149/mo, 50 devices), infinite ($399/mo, 250 devices), enterprise (custom)';


--
-- Name: policy_proposal_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_proposal_events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    proposal_id uuid NOT NULL,
    event_type text NOT NULL,
    safe_summary text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT policy_proposal_events_event_type_check CHECK ((event_type = ANY (ARRAY['created'::text, 'updated'::text, 'simulated'::text, 'status_changed'::text, 'approved'::text, 'archived'::text])))
);


--
-- Name: policy_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_proposals (
    proposal_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    policy_mode text NOT NULL,
    match_criteria_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    latest_simulation_json jsonb,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT policy_proposals_latest_simulation_json_check CHECK (((latest_simulation_json IS NULL) OR (jsonb_typeof(latest_simulation_json) = 'object'::text))),
    CONSTRAINT policy_proposals_match_criteria_json_check CHECK ((jsonb_typeof(match_criteria_json) = 'object'::text)),
    CONSTRAINT policy_proposals_policy_mode_check CHECK ((policy_mode = ANY (ARRAY['require_approval'::text, 'block'::text]))),
    CONSTRAINT policy_proposals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'review_ready'::text, 'approved'::text, 'archived'::text])))
);


--
-- Name: registered_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registered_agents (
    agent_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    agent_type text NOT NULL,
    template_name text DEFAULT ''::text NOT NULL,
    version text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone
);


--
-- Name: robotics_policy_command_nonces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robotics_policy_command_nonces (
    tenant_id text NOT NULL,
    key_version text NOT NULL,
    action text NOT NULL,
    nonce text NOT NULL,
    command_hash text NOT NULL,
    command_signature text NOT NULL,
    actor_id text NOT NULL,
    signer_identity text NOT NULL,
    signed_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: robotics_policy_decision_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robotics_policy_decision_audit (
    policy_decision_id text NOT NULL,
    task_id uuid NOT NULL,
    tenant_id text NOT NULL,
    runtime_id text,
    policy_version text NOT NULL,
    robot_action text NOT NULL,
    robot_node_id text NOT NULL,
    robot_target text,
    permit boolean NOT NULL,
    reason text NOT NULL,
    policy_decision_hash text NOT NULL,
    policy_signature text NOT NULL,
    signed_policy_decision jsonb NOT NULL,
    issued_at_unix_ms bigint NOT NULL,
    expires_at_unix_ms bigint NOT NULL,
    persisted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: robotics_policy_key_lifecycle_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robotics_policy_key_lifecycle_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    key_version text NOT NULL,
    action text NOT NULL,
    actor_id text NOT NULL,
    actor_email text,
    signer_identity text NOT NULL,
    signer_key_version text,
    command_nonce text,
    command_hash text,
    command_signature text,
    previous_status text,
    new_status text NOT NULL,
    key_snapshot jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT robotics_policy_key_lifecycle_audit_action_check CHECK ((action = ANY (ARRAY['create'::text, 'activate'::text, 'revoke'::text, 'expire'::text])))
);


--
-- Name: robotics_policy_lifecycle_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robotics_policy_lifecycle_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    policy_version text NOT NULL,
    action text NOT NULL,
    actor_id text NOT NULL,
    actor_email text,
    signer_identity text NOT NULL,
    previous_status text,
    new_status text NOT NULL,
    policy_snapshot jsonb NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    signer_key_version text,
    command_signature text,
    command_nonce text,
    command_hash text,
    CONSTRAINT robotics_policy_lifecycle_audit_action_check CHECK ((action = ANY (ARRAY['draft'::text, 'update'::text, 'allow_list'::text, 'activate'::text, 'expire'::text, 'revoke'::text])))
);


--
-- Name: robotics_policy_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robotics_policy_settings (
    tenant_id text NOT NULL,
    policy_version text DEFAULT 'robotics-policy.v1'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    permit boolean DEFAULT false NOT NULL,
    runtime_permitted boolean DEFAULT false NOT NULL,
    robot_mode text DEFAULT 'disabled'::text NOT NULL,
    allowed_runtimes jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT false NOT NULL,
    expires_at timestamp with time zone,
    activated_at timestamp with time zone,
    expired_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_by text,
    updated_by text,
    revoked_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: robotics_policy_signing_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robotics_policy_signing_keys (
    tenant_id text NOT NULL,
    key_version text NOT NULL,
    signer_identity text NOT NULL,
    public_key_ed25519 text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    not_before timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_by text,
    revoked_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT robotics_policy_signing_keys_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'revoked'::text, 'expired'::text])))
);


--
-- Name: robotics_receipt_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.robotics_receipt_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    tenant_id text NOT NULL,
    runtime_id text,
    execution_id text NOT NULL,
    policy_decision_id text NOT NULL,
    policy_decision_hash text,
    governed_action_hash text,
    robot_action text NOT NULL,
    routing_decision text NOT NULL,
    receipt_hash text,
    receipt_signature text,
    envelope_signature text,
    violation_occurred boolean DEFAULT false NOT NULL,
    violation text,
    execution_envelope jsonb NOT NULL,
    execution_receipt jsonb NOT NULL,
    persisted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ros_lifecycle_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ros_lifecycle_states (
    id bigint NOT NULL,
    runtime_id text NOT NULL,
    node_name text DEFAULT 'igris_node'::text NOT NULL,
    namespace text DEFAULT '/'::text NOT NULL,
    lifecycle_state text DEFAULT 'Unconfigured'::text NOT NULL,
    air_gapped boolean DEFAULT false NOT NULL,
    last_trace_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ros_lifecycle_states_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ros_lifecycle_states_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ros_lifecycle_states_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ros_lifecycle_states_id_seq OWNED BY public.ros_lifecycle_states.id;


--
-- Name: ros_replay_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ros_replay_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    device_id text NOT NULL,
    tenant_id text NOT NULL,
    bag_filename text,
    status text DEFAULT 'queued'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: ros_topic_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ros_topic_activity (
    id bigint NOT NULL,
    device_id text NOT NULL,
    topic_name text NOT NULL,
    last_message_preview text,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    within_envelope boolean DEFAULT true NOT NULL
);


--
-- Name: ros_topic_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ros_topic_activity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ros_topic_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ros_topic_activity_id_seq OWNED BY public.ros_topic_activity.id;


--
-- Name: ros_topic_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ros_topic_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    bt_action text NOT NULL,
    topic_name text NOT NULL,
    message_type text DEFAULT 'std_msgs/String'::text NOT NULL,
    direction text DEFAULT 'publish'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ros_topic_mappings_direction_check CHECK ((direction = ANY (ARRAY['publish'::text, 'subscribe'::text])))
);


--
-- Name: routing_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routing_config (
    id bigint NOT NULL,
    tenant_id text NOT NULL,
    config_key text NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: routing_config_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.routing_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: routing_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.routing_config_id_seq OWNED BY public.routing_config.id;


--
-- Name: runtime_callback_nonces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_callback_nonces (
    callback_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid NOT NULL,
    runtime_id text NOT NULL,
    callback_type text NOT NULL,
    nonce text NOT NULL,
    body_digest text NOT NULL,
    timestamp_unix_ms bigint NOT NULL,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT runtime_callback_nonces_callback_type_check CHECK ((callback_type = ANY (ARRAY['checkpoint'::text, 'complete'::text, 'failed'::text])))
);


--
-- Name: TABLE runtime_callback_nonces; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.runtime_callback_nonces IS 'Accepted runtime callback nonce metadata for replay protection. Cleanup retains entries for at least the callback freshness window; default application retention is 24 hours.';


--
-- Name: runtime_downloads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_downloads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    ip_address text NOT NULL,
    runtime_version text DEFAULT 'latest'::text NOT NULL,
    platform text NOT NULL,
    user_agent text,
    download_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE runtime_downloads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.runtime_downloads IS 'Audit log of every authenticated runtime binary download. Used for security review and per-tenant rate limiting.';


--
-- Name: runtime_handoff_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_handoff_events (
    handoff_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid NOT NULL,
    source_runtime_id text,
    target_runtime_id text,
    checkpoint_digest text,
    checkpoint_portability text NOT NULL,
    decision text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT runtime_handoff_events_checkpoint_portability_check CHECK ((checkpoint_portability = ANY (ARRAY['same_runtime_only'::text, 'compatible_runtime'::text, 'any_runtime'::text]))),
    CONSTRAINT runtime_handoff_events_decision_check CHECK ((decision = ANY (ARRAY['allowed'::text, 'denied'::text])))
);


--
-- Name: runtime_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runtime_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    runtime_id text NOT NULL,
    public_key_ed25519 text NOT NULL,
    endpoint text NOT NULL,
    capabilities jsonb DEFAULT '[]'::jsonb NOT NULL,
    platform text,
    version text,
    is_edge boolean DEFAULT true NOT NULL,
    is_healthy boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    tenant_id text,
    machine_id text,
    hostname_cached text,
    ip_address text,
    last_heartbeat timestamp with time zone,
    status text DEFAULT 'active'::text NOT NULL,
    pending_commands jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    bt_state jsonb,
    bt_state_updated_at timestamp with time zone,
    ros_topics jsonb DEFAULT '[]'::jsonb,
    pending_commands_clear_generation bigint DEFAULT 0 NOT NULL,
    local_command_spool_depth bigint DEFAULT 0 NOT NULL,
    local_command_clear_generation bigint DEFAULT 0 NOT NULL,
    local_command_statuses jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: TABLE runtime_instances; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.runtime_instances IS 'Registry of active igris-runtime instances forwarded to by Overture. Overture is the control plane; runtimes are the sole execution authority.';


--
-- Name: COLUMN runtime_instances.machine_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.machine_id IS 'SHA-256 fingerprint of MAC address + hostname (dev_{hex[..16]}) — uniquely identifies a physical/virtual host.';


--
-- Name: COLUMN runtime_instances.hostname_cached; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.hostname_cached IS 'Hostname at registration time, cached for display in the fleet dashboard.';


--
-- Name: COLUMN runtime_instances.ip_address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.ip_address IS 'IP address of the runtime at last heartbeat, stored for diagnostics.';


--
-- Name: COLUMN runtime_instances.last_heartbeat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.last_heartbeat IS 'Timestamp of the most recent heartbeat. Runtimes that stop heartbeating are marked stale.';


--
-- Name: COLUMN runtime_instances.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.status IS 'Lifecycle status: active | stale | deregistered';


--
-- Name: COLUMN runtime_instances.bt_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.bt_state IS 'Latest BT tick snapshot: {"tick":N,"status":"Running"|"Success"|"Failure","tree":{...}}. Written by runtime heartbeat during active execution.';


--
-- Name: COLUMN runtime_instances.bt_state_updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.bt_state_updated_at IS 'Timestamp of most recent bt_state write. Used by SSE endpoint to detect changes.';


--
-- Name: COLUMN runtime_instances.ros_topics; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.ros_topics IS 'Dynamic list of ROS2 topics/services discovered by this runtime instance. Merged with ros_topic_mappings in GET /v1/ros/discovery.';


--
-- Name: COLUMN runtime_instances.pending_commands_clear_generation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.pending_commands_clear_generation IS 'Monotonic counter incremented when Overture explicitly clears a runtime command queue; runtimes discard locally spooled commands when this generation advances.';


--
-- Name: COLUMN runtime_instances.local_command_spool_depth; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.local_command_spool_depth IS 'Runtime-reported depth of the locally persisted control-plane command spool after ownership handoff.';


--
-- Name: COLUMN runtime_instances.local_command_clear_generation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.local_command_clear_generation IS 'Runtime-reported clear generation applied to the local command spool.';


--
-- Name: COLUMN runtime_instances.local_command_statuses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.runtime_instances.local_command_statuses IS 'Latest runtime-reported command lifecycle states for queued/owned/executing/revoked/cancelled local spool entries.';


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    id text NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL,
    "impersonatedBy" text
);


--
-- Name: task_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_records (
    task_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    runtime_id text,
    runtime_endpoint text,
    task_definition jsonb NOT NULL,
    last_checkpoint jsonb,
    idempotency_key text NOT NULL,
    failure_reason text,
    deadline_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    execution_envelope jsonb,
    execution_receipt jsonb,
    proof_execution_id text,
    proof_expected_hash text,
    proof_stored_hash text,
    proof_signature text,
    proof_status text,
    proof_checked_at timestamp with time zone,
    canceled_at timestamp with time zone,
    failure_details jsonb,
    proof_verified boolean,
    proof_hash_valid boolean,
    proof_signature_matches boolean,
    proof_runtime_key_found boolean,
    proof_chain_link_valid boolean,
    proof_verification_reason text,
    proof_verified_at timestamp with time zone,
    latest_policy_decision_id uuid,
    recovery_policy text DEFAULT 'automatic_when_safe'::text NOT NULL,
    checkpoint_portability text DEFAULT 'same_runtime_only'::text NOT NULL,
    executed_target text,
    fallback_reason text,
    registered_agent_id uuid,
    registered_agent_name text DEFAULT ''::text NOT NULL,
    CONSTRAINT task_records_checkpoint_portability_check CHECK ((checkpoint_portability = ANY (ARRAY['same_runtime_only'::text, 'compatible_runtime'::text, 'any_runtime'::text]))),
    CONSTRAINT task_records_executed_target_check CHECK (((executed_target IS NULL) OR (executed_target = ANY (ARRAY['hosted_api'::text, 'webhook'::text, 'local_runtime'::text, 'hybrid_fallback'::text, 'mock_demo'::text])))),
    CONSTRAINT task_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'dispatched'::text, 'checkpointed'::text, 'completed'::text, 'failed'::text, 'recovering'::text, 'canceled'::text, 'approval_required'::text])))
);


--
-- Name: task_recovery_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_recovery_events (
    recovery_event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid NOT NULL,
    event_type text NOT NULL,
    source_runtime_id text,
    target_runtime_id text,
    checkpoint_digest text,
    last_committed_step integer,
    replay_allowed boolean,
    reason text NOT NULL,
    event_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    key_hash text NOT NULL,
    key_prefix text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: TABLE tenant_api_keys; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tenant_api_keys IS 'Named API keys issued to tenants. Raw key shown only once at creation time; only the SHA-256 hash is stored for subsequent verification.';


--
-- Name: tenant_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_policies (
    id bigint NOT NULL,
    tenant_id text NOT NULL,
    max_action_nodes integer,
    max_depth integer,
    max_tool_calls integer,
    max_duration_secs integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_policies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_policies_id_seq OWNED BY public.tenant_policies.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    tenant_id text NOT NULL,
    tenant_name text DEFAULT ''::text NOT NULL,
    tenant_email text,
    company text,
    status text DEFAULT 'active'::text NOT NULL,
    tier text DEFAULT 'seed'::text NOT NULL,
    api_key_hash text,
    api_key_prefix text,
    api_key_created_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    runtime_limit integer DEFAULT 1 NOT NULL,
    capabilities_policy jsonb DEFAULT '{}'::jsonb NOT NULL,
    polar_subscription_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trial_active boolean DEFAULT false NOT NULL,
    trial_tier text,
    trial_started_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    trial_expired_at timestamp with time zone,
    trial_converted_at timestamp with time zone,
    trial_reminder_sent_at timestamp with time zone,
    subscription_status text DEFAULT 'none'::text NOT NULL,
    subscription_started_at timestamp with time zone,
    environment text DEFAULT 'production'::text,
    timezone text DEFAULT 'UTC'::text,
    log_level text DEFAULT 'info'::text,
    execution_signing boolean DEFAULT true,
    audit_logging boolean DEFAULT true,
    receipt_retention_days integer DEFAULT 90,
    telemetry_enabled boolean DEFAULT true,
    default_execution_timeout integer DEFAULT 30000,
    runtime_bounds jsonb DEFAULT '{}'::jsonb
);


--
-- Name: COLUMN tenants.api_key_prefix; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.api_key_prefix IS 'First 12 characters of the raw API key (e.g. "igris_a1b2c3"). Shown in the console so the user can identify which key is active without exposing the full secret.';


--
-- Name: COLUMN tenants.api_key_created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.api_key_created_at IS 'UTC timestamp when the current API key was generated or last rotated.';


--
-- Name: COLUMN tenants.runtime_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.runtime_limit IS 'Maximum number of igris-runtime instances the tenant may register. Derived from their active subscription tier: seed=1, horizon=50, infinite=500.';


--
-- Name: COLUMN tenants.polar_subscription_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.polar_subscription_id IS 'Polar.sh subscription ID for this tenant, populated via webhook.';


--
-- Name: COLUMN tenants.trial_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.trial_active IS 'True while the 7-day free trial is running.';


--
-- Name: COLUMN tenants.trial_tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.trial_tier IS 'The tier the tenant selected when starting their trial (seed, horizon, infinite). They get full access to that tier during the trial.';


--
-- Name: COLUMN tenants.trial_ends_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.trial_ends_at IS 'UTC timestamp when the trial expires. The daily cron job (ExpireTrials) checks this and downgrades the tenant if no payment.';


--
-- Name: COLUMN tenants.subscription_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.subscription_status IS 'Subscription lifecycle state: none | trial | active | canceled | expired.';


--
-- Name: tier_change_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tier_change_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    old_tier text,
    new_tier text,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'system'::text
);


--
-- Name: trust_recommendation_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trust_recommendation_states (
    state_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    recommendation_id text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    snoozed_until timestamp with time zone,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trust_recommendation_states_status_check CHECK ((status = ANY (ARRAY['active'::text, 'acknowledged'::text, 'snoozed'::text, 'resolved'::text])))
);


--
-- Name: usage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    license_id uuid NOT NULL,
    request_type character varying(50) NOT NULL,
    provider character varying(50),
    model character varying(100),
    tokens_input integer DEFAULT 0,
    tokens_output integer DEFAULT 0,
    cost_usd numeric(12,6) DEFAULT 0,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    metadata jsonb
);


--
-- Name: usage_monthly; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.usage_monthly AS
 SELECT usage_log.license_id,
    date_trunc('month'::text, usage_log."timestamp") AS month,
    usage_log.request_type,
    count(*) AS request_count,
    sum(usage_log.tokens_input) AS total_tokens_input,
    sum(usage_log.tokens_output) AS total_tokens_output,
    sum(usage_log.cost_usd) AS total_cost_usd,
    max(usage_log."timestamp") AS last_request_at
   FROM public.usage_log
  GROUP BY usage_log.license_id, (date_trunc('month'::text, usage_log."timestamp")), usage_log.request_type
  WITH NO DATA;


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    image text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    role text DEFAULT 'user'::text,
    banned boolean DEFAULT false,
    "banReason" text,
    "banExpires" timestamp without time zone
);


--
-- Name: v_fleet_health; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_fleet_health AS
 SELECT fleet_agents.fleet_id,
    count(*) AS total_agents,
    count(*) FILTER (WHERE ((fleet_agents.status)::text = 'active'::text)) AS active_agents,
    count(*) FILTER (WHERE ((fleet_agents.health)::text = 'healthy'::text)) AS healthy_agents,
    count(*) FILTER (WHERE ((fleet_agents.health)::text = 'degraded'::text)) AS degraded_agents,
    count(*) FILTER (WHERE ((fleet_agents.health)::text = 'unhealthy'::text)) AS unhealthy_agents,
    count(*) FILTER (WHERE (fleet_agents.last_seen < (now() - '00:05:00'::interval))) AS offline_agents,
    max(fleet_agents.last_seen) AS last_agent_seen,
    min(fleet_agents.registered_at) AS oldest_agent_registered
   FROM public.fleet_agents
  GROUP BY fleet_agents.fleet_id;


--
-- Name: v_recent_fleet_events; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_recent_fleet_events AS
 SELECT fleet_events.fleet_id,
    fleet_events.event_type,
    fleet_events.severity,
    count(*) AS event_count,
    max(fleet_events."timestamp") AS last_occurrence,
    array_agg(DISTINCT fleet_events.agent_id ORDER BY fleet_events.agent_id) AS affected_agents
   FROM public.fleet_events
  WHERE (fleet_events."timestamp" >= (now() - '24:00:00'::interval))
  GROUP BY fleet_events.fleet_id, fleet_events.event_type, fleet_events.severity
  ORDER BY (max(fleet_events."timestamp")) DESC;


--
-- Name: v_recent_telemetry; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_recent_telemetry AS
 SELECT t.agent_id,
    a.fleet_id,
    a.hostname,
    t.health_status,
    t.cpu_usage_percent,
    t.memory_usage_mb,
    t.active_tasks,
    t."timestamp",
    a.last_seen,
    a.status
   FROM (public.fleet_telemetry t
     JOIN public.fleet_agents a ON (((t.agent_id)::text = (a.agent_id)::text)))
  WHERE (t."timestamp" >= (now() - '24:00:00'::interval))
  ORDER BY t."timestamp" DESC;


--
-- Name: verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now(),
    "updatedAt" timestamp without time zone DEFAULT now()
);


--
-- Name: verification_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_results (
    verification_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    task_id uuid,
    execution_id text,
    policy_decision_id uuid,
    checkpoint_digest text,
    action_digest text,
    status text NOT NULL,
    policy_compliant boolean,
    evidence_digest text,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT verification_results_status_check CHECK ((status = ANY (ARRAY['verified'::text, 'partially_verified'::text, 'unverifiable'::text, 'failed_verification'::text, 'policy_violation'::text])))
);


--
-- Name: wal_checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wal_checkpoints (
    checkpoint_id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    step_index integer NOT NULL,
    checkpoint_digest bytea NOT NULL,
    wal_entries jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    policy_decision_id uuid,
    checkpoint_digest_hex text,
    checkpoint_portability text DEFAULT 'same_runtime_only'::text NOT NULL,
    CONSTRAINT wal_checkpoints_checkpoint_portability_check CHECK ((checkpoint_portability = ANY (ARRAY['same_runtime_only'::text, 'compatible_runtime'::text, 'any_runtime'::text])))
);


--
-- Name: circuit_breaker_states id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circuit_breaker_states ALTER COLUMN id SET DEFAULT nextval('public.circuit_breaker_states_id_seq'::regclass);


--
-- Name: council_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.council_results ALTER COLUMN id SET DEFAULT nextval('public.council_results_id_seq'::regclass);


--
-- Name: device_containment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_containment ALTER COLUMN id SET DEFAULT nextval('public.device_containment_id_seq'::regclass);


--
-- Name: federated_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.federated_config ALTER COLUMN id SET DEFAULT nextval('public.federated_config_id_seq'::regclass);


--
-- Name: federated_rounds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.federated_rounds ALTER COLUMN id SET DEFAULT nextval('public.federated_rounds_id_seq'::regclass);


--
-- Name: ros_lifecycle_states id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ros_lifecycle_states ALTER COLUMN id SET DEFAULT nextval('public.ros_lifecycle_states_id_seq'::regclass);


--
-- Name: ros_topic_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ros_topic_activity ALTER COLUMN id SET DEFAULT nextval('public.ros_topic_activity_id_seq'::regclass);


--
-- Name: routing_config id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_config ALTER COLUMN id SET DEFAULT nextval('public.routing_config_id_seq'::regclass);


--
-- Name: tenant_policies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_policies ALTER COLUMN id SET DEFAULT nextval('public.tenant_policies_id_seq'::regclass);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: action_definitions action_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_definitions
    ADD CONSTRAINT action_definitions_pkey PRIMARY KEY (id);


--
-- Name: action_policy_decisions action_policy_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_policy_decisions
    ADD CONSTRAINT action_policy_decisions_pkey PRIMARY KEY (decision_id);


--
-- Name: agent_blackboard agent_blackboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_blackboard
    ADD CONSTRAINT agent_blackboard_pkey PRIMARY KEY (id);


--
-- Name: agent_blackboard agent_blackboard_tenant_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_blackboard
    ADD CONSTRAINT agent_blackboard_tenant_id_key_key UNIQUE (tenant_id, key);


--
-- Name: agent_evidence_memory agent_evidence_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_evidence_memory
    ADD CONSTRAINT agent_evidence_memory_pkey PRIMARY KEY (memory_id);


--
-- Name: agent_settings agent_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_settings
    ADD CONSTRAINT agent_settings_pkey PRIMARY KEY (agent_id, tenant_id);


--
-- Name: ai_capability_decision_audit ai_capability_decision_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_capability_decision_audit
    ADD CONSTRAINT ai_capability_decision_audit_pkey PRIMARY KEY (envelope_id, capability);


--
-- Name: ai_capability_policy_lifecycle_audit ai_capability_policy_lifecycle_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_capability_policy_lifecycle_audit
    ADD CONSTRAINT ai_capability_policy_lifecycle_audit_pkey PRIMARY KEY (id);


--
-- Name: ai_capability_policy_settings ai_capability_policy_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_capability_policy_settings
    ADD CONSTRAINT ai_capability_policy_settings_pkey PRIMARY KEY (tenant_id, policy_version);


--
-- Name: ai_credential_ref_audit ai_credential_ref_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credential_ref_audit
    ADD CONSTRAINT ai_credential_ref_audit_pkey PRIMARY KEY (reference_id);


--
-- Name: ai_task_permission_audit ai_task_permission_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_task_permission_audit
    ADD CONSTRAINT ai_task_permission_audit_pkey PRIMARY KEY (envelope_id);


--
-- Name: ai_task_permission_audit ai_task_permission_audit_task_id_envelope_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_task_permission_audit
    ADD CONSTRAINT ai_task_permission_audit_task_id_envelope_id_key UNIQUE (task_id, envelope_id);


--
-- Name: ai_tool_receipt_audit ai_tool_receipt_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_tool_receipt_audit
    ADD CONSTRAINT ai_tool_receipt_audit_pkey PRIMARY KEY (task_id, execution_id);


--
-- Name: approval_requests approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_pkey PRIMARY KEY (approval_id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: boundary_violations boundary_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boundary_violations
    ADD CONSTRAINT boundary_violations_pkey PRIMARY KEY (violation_id);


--
-- Name: bt_definitions bt_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bt_definitions
    ADD CONSTRAINT bt_definitions_pkey PRIMARY KEY (id);


--
-- Name: bt_definitions bt_definitions_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bt_definitions
    ADD CONSTRAINT bt_definitions_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: circuit_breaker_states circuit_breaker_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circuit_breaker_states
    ADD CONSTRAINT circuit_breaker_states_pkey PRIMARY KEY (id);


--
-- Name: circuit_breaker_states circuit_breaker_states_tenant_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circuit_breaker_states
    ADD CONSTRAINT circuit_breaker_states_tenant_id_provider_key UNIQUE (tenant_id, provider);


--
-- Name: council_results council_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.council_results
    ADD CONSTRAINT council_results_pkey PRIMARY KEY (id);


--
-- Name: device_containment device_containment_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_containment
    ADD CONSTRAINT device_containment_device_id_key UNIQUE (device_id);


--
-- Name: device_containment device_containment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_containment
    ADD CONSTRAINT device_containment_pkey PRIMARY KEY (id);


--
-- Name: devices devices_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_device_id_key UNIQUE (device_id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: execution_boundaries execution_boundaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_boundaries
    ADD CONSTRAINT execution_boundaries_pkey PRIMARY KEY (boundary_id);


--
-- Name: execution_context execution_context_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_context
    ADD CONSTRAINT execution_context_pkey PRIMARY KEY (execution_id);


--
-- Name: execution_eval_runs execution_eval_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_eval_runs
    ADD CONSTRAINT execution_eval_runs_pkey PRIMARY KEY (eval_run_id);


--
-- Name: execution_evals execution_evals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_evals
    ADD CONSTRAINT execution_evals_pkey PRIMARY KEY (eval_id);


--
-- Name: execution_input_ref_audit execution_input_ref_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_input_ref_audit
    ADD CONSTRAINT execution_input_ref_audit_pkey PRIMARY KEY (event_id);


--
-- Name: execution_input_refs execution_input_refs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_input_refs
    ADD CONSTRAINT execution_input_refs_pkey PRIMARY KEY (id);


--
-- Name: execution_lineage execution_lineage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_lineage
    ADD CONSTRAINT execution_lineage_pkey PRIMARY KEY (id);


--
-- Name: federated_config federated_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.federated_config
    ADD CONSTRAINT federated_config_pkey PRIMARY KEY (id);


--
-- Name: federated_participants federated_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.federated_participants
    ADD CONSTRAINT federated_participants_pkey PRIMARY KEY (id);


--
-- Name: federated_participants federated_participants_tenant_id_device_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.federated_participants
    ADD CONSTRAINT federated_participants_tenant_id_device_id_key UNIQUE (tenant_id, device_id);


--
-- Name: federated_rounds federated_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.federated_rounds
    ADD CONSTRAINT federated_rounds_pkey PRIMARY KEY (id);


--
-- Name: fleet_agents fleet_agents_agent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_agents
    ADD CONSTRAINT fleet_agents_agent_id_key UNIQUE (agent_id);


--
-- Name: fleet_agents fleet_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_agents
    ADD CONSTRAINT fleet_agents_pkey PRIMARY KEY (id);


--
-- Name: fleet_configs fleet_configs_fleet_id_agent_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_configs
    ADD CONSTRAINT fleet_configs_fleet_id_agent_id_version_key UNIQUE (fleet_id, agent_id, version);


--
-- Name: fleet_configs fleet_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_configs
    ADD CONSTRAINT fleet_configs_pkey PRIMARY KEY (id);


--
-- Name: fleet_events fleet_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_events
    ADD CONSTRAINT fleet_events_pkey PRIMARY KEY (id);


--
-- Name: fleet_telemetry fleet_telemetry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_telemetry
    ADD CONSTRAINT fleet_telemetry_pkey PRIMARY KEY (id);


--
-- Name: licenses licenses_license_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_license_key_key UNIQUE (license_key);


--
-- Name: licenses licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_pkey PRIMARY KEY (id);


--
-- Name: policy_proposal_events policy_proposal_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_proposal_events
    ADD CONSTRAINT policy_proposal_events_pkey PRIMARY KEY (event_id);


--
-- Name: policy_proposals policy_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_proposals
    ADD CONSTRAINT policy_proposals_pkey PRIMARY KEY (proposal_id);


--
-- Name: registered_agents registered_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registered_agents
    ADD CONSTRAINT registered_agents_pkey PRIMARY KEY (agent_id);


--
-- Name: robotics_policy_command_nonces robotics_policy_command_nonces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robotics_policy_command_nonces
    ADD CONSTRAINT robotics_policy_command_nonces_pkey PRIMARY KEY (tenant_id, key_version, action, nonce);


--
-- Name: robotics_policy_decision_audit robotics_policy_decision_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robotics_policy_decision_audit
    ADD CONSTRAINT robotics_policy_decision_audit_pkey PRIMARY KEY (policy_decision_id);


--
-- Name: robotics_policy_decision_audit robotics_policy_decision_audit_task_id_policy_decision_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robotics_policy_decision_audit
    ADD CONSTRAINT robotics_policy_decision_audit_task_id_policy_decision_id_key UNIQUE (task_id, policy_decision_id);


--
-- Name: robotics_policy_key_lifecycle_audit robotics_policy_key_lifecycle_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robotics_policy_key_lifecycle_audit
    ADD CONSTRAINT robotics_policy_key_lifecycle_audit_pkey PRIMARY KEY (id);


--
-- Name: robotics_policy_lifecycle_audit robotics_policy_lifecycle_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robotics_policy_lifecycle_audit
    ADD CONSTRAINT robotics_policy_lifecycle_audit_pkey PRIMARY KEY (id);


--
-- Name: robotics_policy_settings robotics_policy_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robotics_policy_settings
    ADD CONSTRAINT robotics_policy_settings_pkey PRIMARY KEY (tenant_id, policy_version);


--
-- Name: robotics_policy_signing_keys robotics_policy_signing_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robotics_policy_signing_keys
    ADD CONSTRAINT robotics_policy_signing_keys_pkey PRIMARY KEY (tenant_id, key_version);


--
-- Name: robotics_receipt_audit robotics_receipt_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robotics_receipt_audit
    ADD CONSTRAINT robotics_receipt_audit_pkey PRIMARY KEY (id);


--
-- Name: robotics_receipt_audit robotics_receipt_audit_task_id_execution_id_policy_decision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.robotics_receipt_audit
    ADD CONSTRAINT robotics_receipt_audit_task_id_execution_id_policy_decision_key UNIQUE (task_id, execution_id, policy_decision_id);


--
-- Name: ros_lifecycle_states ros_lifecycle_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ros_lifecycle_states
    ADD CONSTRAINT ros_lifecycle_states_pkey PRIMARY KEY (id);


--
-- Name: ros_lifecycle_states ros_lifecycle_states_runtime_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ros_lifecycle_states
    ADD CONSTRAINT ros_lifecycle_states_runtime_id_key UNIQUE (runtime_id);


--
-- Name: ros_replay_jobs ros_replay_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ros_replay_jobs
    ADD CONSTRAINT ros_replay_jobs_pkey PRIMARY KEY (id);


--
-- Name: ros_topic_activity ros_topic_activity_device_id_topic_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ros_topic_activity
    ADD CONSTRAINT ros_topic_activity_device_id_topic_name_key UNIQUE (device_id, topic_name);


--
-- Name: ros_topic_activity ros_topic_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ros_topic_activity
    ADD CONSTRAINT ros_topic_activity_pkey PRIMARY KEY (id);


--
-- Name: ros_topic_mappings ros_topic_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ros_topic_mappings
    ADD CONSTRAINT ros_topic_mappings_pkey PRIMARY KEY (id);


--
-- Name: routing_config routing_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_config
    ADD CONSTRAINT routing_config_pkey PRIMARY KEY (id);


--
-- Name: routing_config routing_config_tenant_id_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routing_config
    ADD CONSTRAINT routing_config_tenant_id_config_key_key UNIQUE (tenant_id, config_key);


--
-- Name: runtime_callback_nonces runtime_callback_nonces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_callback_nonces
    ADD CONSTRAINT runtime_callback_nonces_pkey PRIMARY KEY (callback_id);


--
-- Name: runtime_callback_nonces runtime_callback_nonces_tenant_id_runtime_id_nonce_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_callback_nonces
    ADD CONSTRAINT runtime_callback_nonces_tenant_id_runtime_id_nonce_key UNIQUE (tenant_id, runtime_id, nonce);


--
-- Name: runtime_downloads runtime_downloads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_downloads
    ADD CONSTRAINT runtime_downloads_pkey PRIMARY KEY (id);


--
-- Name: runtime_handoff_events runtime_handoff_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_handoff_events
    ADD CONSTRAINT runtime_handoff_events_pkey PRIMARY KEY (handoff_event_id);


--
-- Name: runtime_instances runtime_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_instances
    ADD CONSTRAINT runtime_instances_pkey PRIMARY KEY (id);


--
-- Name: runtime_instances runtime_instances_runtime_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runtime_instances
    ADD CONSTRAINT runtime_instances_runtime_id_key UNIQUE (runtime_id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: session session_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_token_key UNIQUE (token);


--
-- Name: task_records task_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_records
    ADD CONSTRAINT task_records_pkey PRIMARY KEY (task_id);


--
-- Name: task_recovery_events task_recovery_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_recovery_events
    ADD CONSTRAINT task_recovery_events_pkey PRIMARY KEY (recovery_event_id);


--
-- Name: tenant_api_keys tenant_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_api_keys
    ADD CONSTRAINT tenant_api_keys_pkey PRIMARY KEY (id);


--
-- Name: tenant_policies tenant_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_policies
    ADD CONSTRAINT tenant_policies_pkey PRIMARY KEY (id);


--
-- Name: tenant_policies tenant_policies_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_policies
    ADD CONSTRAINT tenant_policies_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (tenant_id);


--
-- Name: tier_change_log tier_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_change_log
    ADD CONSTRAINT tier_change_log_pkey PRIMARY KEY (id);


--
-- Name: trust_recommendation_states trust_recommendation_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_recommendation_states
    ADD CONSTRAINT trust_recommendation_states_pkey PRIMARY KEY (state_id);


--
-- Name: trust_recommendation_states trust_recommendation_states_tenant_id_recommendation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trust_recommendation_states
    ADD CONSTRAINT trust_recommendation_states_tenant_id_recommendation_id_key UNIQUE (tenant_id, recommendation_id);


--
-- Name: usage_log usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_log
    ADD CONSTRAINT usage_log_pkey PRIMARY KEY (id);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: verification_results verification_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_results
    ADD CONSTRAINT verification_results_pkey PRIMARY KEY (verification_id);


--
-- Name: wal_checkpoints wal_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wal_checkpoints
    ADD CONSTRAINT wal_checkpoints_pkey PRIMARY KEY (checkpoint_id);


--
-- Name: action_definitions_tenant_name_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX action_definitions_tenant_name_active_idx ON public.action_definitions USING btree (tenant_id, name) WHERE (archived_at IS NULL);


--
-- Name: action_definitions_tenant_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX action_definitions_tenant_updated_idx ON public.action_definitions USING btree (tenant_id, updated_at DESC) WHERE (archived_at IS NULL);


--
-- Name: agent_evidence_memory_agent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_evidence_memory_agent_idx ON public.agent_evidence_memory USING btree (tenant_id, registered_agent_id, created_at DESC) WHERE (registered_agent_id IS NOT NULL);


--
-- Name: agent_evidence_memory_execution_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_evidence_memory_execution_idx ON public.agent_evidence_memory USING btree (tenant_id, execution_id, created_at DESC) WHERE (execution_id <> ''::text);


--
-- Name: agent_evidence_memory_retention_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_evidence_memory_retention_idx ON public.agent_evidence_memory USING btree (tenant_id, retention_expires_at) WHERE (retention_expires_at IS NOT NULL);


--
-- Name: agent_evidence_memory_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_evidence_memory_task_idx ON public.agent_evidence_memory USING btree (tenant_id, task_id, created_at DESC) WHERE (task_id IS NOT NULL);


--
-- Name: execution_context_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX execution_context_task_idx ON public.execution_context USING btree (task_id, updated_at DESC) WHERE (task_id IS NOT NULL);


--
-- Name: execution_context_tenant_execution_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX execution_context_tenant_execution_idx ON public.execution_context USING btree (tenant_id, execution_id);


--
-- Name: execution_context_tenant_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX execution_context_tenant_updated_idx ON public.execution_context USING btree (tenant_id, updated_at DESC);


--
-- Name: execution_input_ref_audit_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX execution_input_ref_audit_ref_idx ON public.execution_input_ref_audit USING btree (input_ref_id, created_at DESC) WHERE (input_ref_id IS NOT NULL);


--
-- Name: execution_input_ref_audit_tenant_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX execution_input_ref_audit_tenant_task_idx ON public.execution_input_ref_audit USING btree (tenant_id, task_id, created_at DESC);


--
-- Name: execution_input_refs_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX execution_input_refs_action_idx ON public.execution_input_refs USING btree (tenant_id, action_id, created_at DESC) WHERE (action_id IS NOT NULL);


--
-- Name: execution_input_refs_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX execution_input_refs_expiry_idx ON public.execution_input_refs USING btree (expires_at) WHERE ((expires_at IS NOT NULL) AND (revoked_at IS NULL));


--
-- Name: execution_input_refs_revoked_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX execution_input_refs_revoked_idx ON public.execution_input_refs USING btree (tenant_id, revoked_at) WHERE (revoked_at IS NOT NULL);


--
-- Name: execution_input_refs_tenant_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX execution_input_refs_tenant_task_idx ON public.execution_input_refs USING btree (tenant_id, task_id, purpose, created_at DESC);


--
-- Name: idx_account_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_user ON public.account USING btree ("userId");


--
-- Name: idx_action_policy_decisions_decision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_policy_decisions_decision ON public.action_policy_decisions USING btree (tenant_id, decision, created_at DESC);


--
-- Name: idx_action_policy_decisions_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_policy_decisions_runtime ON public.action_policy_decisions USING btree (tenant_id, runtime_id, created_at DESC) WHERE (runtime_id IS NOT NULL);


--
-- Name: idx_action_policy_decisions_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_action_policy_decisions_task ON public.action_policy_decisions USING btree (tenant_id, task_id, created_at DESC);


--
-- Name: idx_agent_blackboard_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_blackboard_tenant ON public.agent_blackboard USING btree (tenant_id);


--
-- Name: idx_agent_settings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agent_settings_tenant ON public.agent_settings USING btree (tenant_id);


--
-- Name: idx_ai_capability_decision_audit_capability; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_capability_decision_audit_capability ON public.ai_capability_decision_audit USING btree (tenant_id, capability, persisted_at DESC);


--
-- Name: idx_ai_capability_decision_audit_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_capability_decision_audit_policy ON public.ai_capability_decision_audit USING btree (tenant_id, policy_version, persisted_at DESC);


--
-- Name: idx_ai_capability_policy_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ai_capability_policy_active ON public.ai_capability_policy_settings USING btree (tenant_id) WHERE (active = true);


--
-- Name: idx_ai_capability_policy_lifecycle_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_capability_policy_lifecycle_actor ON public.ai_capability_policy_lifecycle_audit USING btree (tenant_id, actor_id, occurred_at DESC);


--
-- Name: idx_ai_capability_policy_lifecycle_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_capability_policy_lifecycle_policy ON public.ai_capability_policy_lifecycle_audit USING btree (tenant_id, policy_version, occurred_at DESC);


--
-- Name: idx_ai_capability_policy_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_capability_policy_status ON public.ai_capability_policy_settings USING btree (tenant_id, status, updated_at DESC);


--
-- Name: idx_ai_credential_ref_audit_capability; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_credential_ref_audit_capability ON public.ai_credential_ref_audit USING btree (tenant_id, capability, persisted_at DESC);


--
-- Name: idx_ai_credential_ref_audit_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_credential_ref_audit_task ON public.ai_credential_ref_audit USING btree (tenant_id, task_id, persisted_at DESC);


--
-- Name: idx_ai_task_permission_audit_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_task_permission_audit_agent ON public.ai_task_permission_audit USING btree (tenant_id, agent_id, persisted_at DESC);


--
-- Name: idx_ai_task_permission_audit_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_task_permission_audit_task ON public.ai_task_permission_audit USING btree (tenant_id, task_id, persisted_at DESC);


--
-- Name: idx_ai_tool_receipt_audit_envelope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_tool_receipt_audit_envelope ON public.ai_tool_receipt_audit USING btree (tenant_id, envelope_id, persisted_at DESC);


--
-- Name: idx_ai_tool_receipt_audit_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_tool_receipt_audit_task ON public.ai_tool_receipt_audit USING btree (tenant_id, task_id, persisted_at DESC);


--
-- Name: idx_ai_tool_receipt_audit_tool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_tool_receipt_audit_tool ON public.ai_tool_receipt_audit USING btree (tenant_id, tool_name, persisted_at DESC);


--
-- Name: idx_approval_requests_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_requests_pending ON public.approval_requests USING btree (tenant_id, requested_at DESC) WHERE (status = 'pending'::text);


--
-- Name: idx_approval_requests_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_requests_task ON public.approval_requests USING btree (tenant_id, task_id, requested_at DESC);


--
-- Name: idx_audit_events_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_tenant ON public.audit_events USING btree (tenant_id, "timestamp" DESC);


--
-- Name: idx_audit_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_events_type ON public.audit_events USING btree (event_type, "timestamp" DESC);


--
-- Name: idx_boundary_violations_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_boundary_violations_task ON public.boundary_violations USING btree (tenant_id, task_id, created_at DESC);


--
-- Name: idx_bt_definitions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bt_definitions_tenant ON public.bt_definitions USING btree (tenant_id, updated_at DESC);


--
-- Name: idx_circuit_breaker_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_circuit_breaker_tenant ON public.circuit_breaker_states USING btree (tenant_id);


--
-- Name: idx_council_results_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_council_results_tenant_created ON public.council_results USING btree (tenant_id, created_at DESC);


--
-- Name: idx_devices_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_device_id ON public.devices USING btree (device_id);


--
-- Name: idx_devices_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_last_seen ON public.devices USING btree (last_seen);


--
-- Name: idx_devices_license; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_license ON public.devices USING btree (license_id);


--
-- Name: idx_devices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_devices_status ON public.devices USING btree (license_id, status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_execution_boundaries_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_boundaries_task ON public.execution_boundaries USING btree (tenant_id, task_id, created_at DESC);


--
-- Name: idx_execution_eval_runs_eval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_eval_runs_eval ON public.execution_eval_runs USING btree (tenant_id, eval_id, created_at DESC);


--
-- Name: idx_execution_eval_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_eval_runs_status ON public.execution_eval_runs USING btree (tenant_id, status, created_at DESC);


--
-- Name: idx_execution_eval_runs_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_eval_runs_task ON public.execution_eval_runs USING btree (tenant_id, task_id, created_at DESC);


--
-- Name: idx_execution_evals_tenant_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_evals_tenant_action ON public.execution_evals USING btree (tenant_id, target_action_name) WHERE ((archived_at IS NULL) AND (target_action_name <> ''::text));


--
-- Name: idx_execution_evals_tenant_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_evals_tenant_active ON public.execution_evals USING btree (tenant_id, created_at DESC) WHERE (archived_at IS NULL);


--
-- Name: idx_execution_lineage_alerts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_lineage_alerts ON public.execution_lineage USING btree (tenant_id, violation_occurred, timestamp_utc DESC) WHERE (violation_occurred = true);


--
-- Name: idx_execution_lineage_execution_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_execution_lineage_execution_id ON public.execution_lineage USING btree (execution_id);


--
-- Name: idx_execution_lineage_paused; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_lineage_paused ON public.execution_lineage USING btree (tenant_id, status) WHERE (status = 'PAUSED'::text);


--
-- Name: idx_execution_lineage_previous_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_lineage_previous_hash ON public.execution_lineage USING btree (previous_hash);


--
-- Name: idx_execution_lineage_shadow_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_lineage_shadow_run ON public.execution_lineage USING btree (shadow_run_id) WHERE (shadow_run_id IS NOT NULL);


--
-- Name: idx_execution_lineage_tenant_persisted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_lineage_tenant_persisted ON public.execution_lineage USING btree (tenant_id, persisted_at DESC);


--
-- Name: idx_execution_lineage_tenant_receipt_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_lineage_tenant_receipt_hash ON public.execution_lineage USING btree (tenant_id, receipt_hash);


--
-- Name: idx_execution_lineage_violations; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_execution_lineage_violations ON public.execution_lineage USING btree (violation_occurred, persisted_at DESC) WHERE (violation_occurred = true);


--
-- Name: idx_federated_participants_last_seen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_federated_participants_last_seen ON public.federated_participants USING btree (last_seen DESC);


--
-- Name: idx_federated_participants_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_federated_participants_tenant ON public.federated_participants USING btree (tenant_id);


--
-- Name: idx_federated_rounds_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_federated_rounds_started_at ON public.federated_rounds USING btree (started_at DESC);


--
-- Name: idx_federated_rounds_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_federated_rounds_tenant_status ON public.federated_rounds USING btree (tenant_id, status);


--
-- Name: idx_fleet_agents_agent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_agents_agent_id ON public.fleet_agents USING btree (agent_id);


--
-- Name: idx_fleet_agents_capabilities; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_agents_capabilities ON public.fleet_agents USING gin (capabilities);


--
-- Name: idx_fleet_agents_fleet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_agents_fleet_id ON public.fleet_agents USING btree (fleet_id);


--
-- Name: idx_fleet_agents_health; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_agents_health ON public.fleet_agents USING btree (health) WHERE ((health)::text = ANY ((ARRAY['degraded'::character varying, 'unhealthy'::character varying])::text[]));


--
-- Name: idx_fleet_agents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_agents_status ON public.fleet_agents USING btree (status, last_seen DESC);


--
-- Name: idx_fleet_configs_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_configs_agent ON public.fleet_configs USING btree (agent_id, version DESC);


--
-- Name: idx_fleet_configs_fleet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_configs_fleet ON public.fleet_configs USING btree (fleet_id, version DESC);


--
-- Name: idx_fleet_events_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_events_agent ON public.fleet_events USING btree (agent_id, "timestamp" DESC);


--
-- Name: idx_fleet_events_fleet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_events_fleet ON public.fleet_events USING btree (fleet_id, "timestamp" DESC);


--
-- Name: idx_fleet_events_severity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_events_severity ON public.fleet_events USING btree (severity, "timestamp" DESC) WHERE ((severity)::text = ANY ((ARRAY['error'::character varying, 'critical'::character varying])::text[]));


--
-- Name: idx_fleet_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_events_type ON public.fleet_events USING btree (event_type, "timestamp" DESC);


--
-- Name: idx_fleet_telemetry_agent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_telemetry_agent ON public.fleet_telemetry USING btree (agent_id, "timestamp" DESC);


--
-- Name: idx_fleet_telemetry_fleet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_telemetry_fleet ON public.fleet_telemetry USING btree (fleet_id, "timestamp" DESC);


--
-- Name: idx_fleet_telemetry_health; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_telemetry_health ON public.fleet_telemetry USING btree (health_status, "timestamp" DESC) WHERE ((health_status)::text = ANY ((ARRAY['degraded'::character varying, 'unhealthy'::character varying])::text[]));


--
-- Name: idx_fleet_telemetry_metrics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fleet_telemetry_metrics ON public.fleet_telemetry USING gin (metrics);


--
-- Name: idx_licenses_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_customer ON public.licenses USING btree (customer_email);


--
-- Name: idx_licenses_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_key ON public.licenses USING btree (license_key);


--
-- Name: idx_licenses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_status ON public.licenses USING btree (status) WHERE ((status)::text = 'active'::text);


--
-- Name: idx_licenses_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_licenses_tenant_id ON public.licenses USING btree (tenant_id) WHERE (tenant_id IS NOT NULL);


--
-- Name: idx_policy_proposal_events_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_proposal_events_proposal ON public.policy_proposal_events USING btree (tenant_id, proposal_id, created_at DESC);


--
-- Name: idx_policy_proposals_tenant_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_proposals_tenant_active ON public.policy_proposals USING btree (tenant_id, updated_at DESC) WHERE (archived_at IS NULL);


--
-- Name: idx_policy_proposals_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_proposals_tenant_status ON public.policy_proposals USING btree (tenant_id, status, updated_at DESC) WHERE (archived_at IS NULL);


--
-- Name: idx_robotics_policy_command_nonces_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_command_nonces_expiry ON public.robotics_policy_command_nonces USING btree (expires_at);


--
-- Name: idx_robotics_policy_decision_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_decision_audit_action ON public.robotics_policy_decision_audit USING btree (tenant_id, robot_action, persisted_at DESC);


--
-- Name: idx_robotics_policy_decision_audit_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_decision_audit_policy ON public.robotics_policy_decision_audit USING btree (tenant_id, policy_version, persisted_at DESC);


--
-- Name: idx_robotics_policy_decision_audit_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_decision_audit_task ON public.robotics_policy_decision_audit USING btree (tenant_id, task_id, persisted_at DESC);


--
-- Name: idx_robotics_policy_key_lifecycle_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_key_lifecycle_audit_actor ON public.robotics_policy_key_lifecycle_audit USING btree (tenant_id, actor_id, occurred_at DESC);


--
-- Name: idx_robotics_policy_key_lifecycle_audit_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_key_lifecycle_audit_key ON public.robotics_policy_key_lifecycle_audit USING btree (tenant_id, key_version, occurred_at DESC);


--
-- Name: idx_robotics_policy_lifecycle_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_lifecycle_audit_actor ON public.robotics_policy_lifecycle_audit USING btree (tenant_id, actor_id, occurred_at DESC);


--
-- Name: idx_robotics_policy_lifecycle_audit_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_lifecycle_audit_policy ON public.robotics_policy_lifecycle_audit USING btree (tenant_id, policy_version, occurred_at DESC);


--
-- Name: idx_robotics_policy_lifecycle_audit_signer_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_lifecycle_audit_signer_key ON public.robotics_policy_lifecycle_audit USING btree (tenant_id, signer_key_version, occurred_at DESC);


--
-- Name: idx_robotics_policy_settings_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_settings_active ON public.robotics_policy_settings USING btree (tenant_id, active, updated_at DESC);


--
-- Name: idx_robotics_policy_settings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_settings_status ON public.robotics_policy_settings USING btree (tenant_id, status, updated_at DESC);


--
-- Name: idx_robotics_policy_signing_keys_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_policy_signing_keys_active ON public.robotics_policy_signing_keys USING btree (tenant_id, status, not_before, expires_at);


--
-- Name: idx_robotics_receipt_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_receipt_audit_action ON public.robotics_receipt_audit USING btree (tenant_id, robot_action, persisted_at DESC);


--
-- Name: idx_robotics_receipt_audit_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_receipt_audit_policy ON public.robotics_receipt_audit USING btree (tenant_id, policy_decision_id, persisted_at DESC);


--
-- Name: idx_robotics_receipt_audit_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_robotics_receipt_audit_task ON public.robotics_receipt_audit USING btree (tenant_id, task_id, persisted_at DESC);


--
-- Name: idx_ros_lifecycle_runtime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ros_lifecycle_runtime ON public.ros_lifecycle_states USING btree (runtime_id);


--
-- Name: idx_ros_replay_jobs_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ros_replay_jobs_device ON public.ros_replay_jobs USING btree (device_id, status);


--
-- Name: idx_ros_topic_activity_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ros_topic_activity_device ON public.ros_topic_activity USING btree (device_id);


--
-- Name: idx_ros_topic_mappings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ros_topic_mappings_tenant ON public.ros_topic_mappings USING btree (tenant_id);


--
-- Name: idx_routing_config_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_routing_config_tenant ON public.routing_config USING btree (tenant_id, config_key);


--
-- Name: idx_runtime_callback_nonces_retention; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_callback_nonces_retention ON public.runtime_callback_nonces USING btree (accepted_at);


--
-- Name: idx_runtime_callback_nonces_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_callback_nonces_task ON public.runtime_callback_nonces USING btree (tenant_id, task_id, accepted_at DESC);


--
-- Name: idx_runtime_downloads_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_downloads_tenant ON public.runtime_downloads USING btree (tenant_id, download_at DESC);


--
-- Name: idx_runtime_downloads_tenant_hour; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_downloads_tenant_hour ON public.runtime_downloads USING btree (tenant_id, date_trunc('hour'::text, (download_at AT TIME ZONE 'UTC'::text)));


--
-- Name: idx_runtime_handoff_events_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_handoff_events_task ON public.runtime_handoff_events USING btree (tenant_id, task_id, created_at DESC);


--
-- Name: idx_runtime_instances_bt_state_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_instances_bt_state_updated ON public.runtime_instances USING btree (tenant_id, machine_id, bt_state_updated_at DESC NULLS LAST);


--
-- Name: idx_runtime_instances_healthy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_instances_healthy ON public.runtime_instances USING btree (is_healthy, last_seen_at DESC);


--
-- Name: idx_runtime_instances_machine_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_instances_machine_id ON public.runtime_instances USING btree (machine_id) WHERE (machine_id IS NOT NULL);


--
-- Name: idx_runtime_instances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_instances_tenant ON public.runtime_instances USING btree (tenant_id);


--
-- Name: idx_runtime_instances_tenant_machine; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_runtime_instances_tenant_machine ON public.runtime_instances USING btree (tenant_id, machine_id) WHERE (machine_id IS NOT NULL);


--
-- Name: idx_runtime_instances_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runtime_instances_tenant_status ON public.runtime_instances USING btree (tenant_id, status);


--
-- Name: idx_session_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_token ON public.session USING btree (token);


--
-- Name: idx_session_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_user ON public.session USING btree ("userId");


--
-- Name: idx_task_recovery_events_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_recovery_events_task ON public.task_recovery_events USING btree (tenant_id, task_id, created_at);


--
-- Name: idx_tenant_api_keys_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_api_keys_tenant ON public.tenant_api_keys USING btree (tenant_id, status);


--
-- Name: idx_tenant_policies_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_policies_tenant ON public.tenant_policies USING btree (tenant_id);


--
-- Name: idx_tenants_api_key_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_api_key_hash ON public.tenants USING btree (api_key_hash) WHERE (api_key_hash IS NOT NULL);


--
-- Name: idx_tenants_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tenants_tenant_id ON public.tenants USING btree (tenant_id);


--
-- Name: idx_tenants_trial_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_trial_expiry ON public.tenants USING btree (trial_ends_at) WHERE (trial_active = true);


--
-- Name: idx_tier_change_log_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tier_change_log_tenant ON public.tier_change_log USING btree (tenant_id, changed_at DESC);


--
-- Name: idx_trust_rec_states_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trust_rec_states_tenant ON public.trust_recommendation_states USING btree (tenant_id, status);


--
-- Name: idx_usage_log_license_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_log_license_time ON public.usage_log USING btree (license_id, "timestamp" DESC);


--
-- Name: idx_usage_log_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_log_month ON public.usage_log USING btree (date_trunc('month'::text, "timestamp"), license_id);


--
-- Name: idx_usage_log_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_log_provider ON public.usage_log USING btree (provider, "timestamp" DESC);


--
-- Name: idx_usage_log_request_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_log_request_type ON public.usage_log USING btree (request_type, license_id);


--
-- Name: idx_usage_monthly_license_month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_usage_monthly_license_month ON public.usage_monthly USING btree (license_id, month, request_type);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- Name: idx_verification_results_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_results_task ON public.verification_results USING btree (tenant_id, task_id, created_at DESC);


--
-- Name: registered_agents_tenant_name_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX registered_agents_tenant_name_active_idx ON public.registered_agents USING btree (tenant_id, name) WHERE (archived_at IS NULL);


--
-- Name: registered_agents_tenant_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX registered_agents_tenant_updated_idx ON public.registered_agents USING btree (tenant_id, updated_at DESC) WHERE (archived_at IS NULL);


--
-- Name: task_records_executed_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_records_executed_target_idx ON public.task_records USING btree (executed_target) WHERE (executed_target IS NOT NULL);


--
-- Name: task_records_proof_execution_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_records_proof_execution_idx ON public.task_records USING btree (tenant_id, proof_execution_id) WHERE (proof_execution_id IS NOT NULL);


--
-- Name: task_records_registered_agent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_records_registered_agent_idx ON public.task_records USING btree (tenant_id, registered_agent_id, created_at DESC) WHERE (registered_agent_id IS NOT NULL);


--
-- Name: task_records_runtime_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_records_runtime_status_idx ON public.task_records USING btree (runtime_id, status) WHERE (status = ANY (ARRAY['dispatched'::text, 'checkpointed'::text, 'recovering'::text]));


--
-- Name: task_records_tenant_id_idempotency_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX task_records_tenant_id_idempotency_key_idx ON public.task_records USING btree (tenant_id, idempotency_key);


--
-- Name: task_records_tenant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_records_tenant_status_idx ON public.task_records USING btree (tenant_id, status, created_at DESC);


--
-- Name: wal_checkpoints_task_step_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wal_checkpoints_task_step_idx ON public.wal_checkpoints USING btree (task_id, step_index DESC);


--
-- Name: execution_lineage task_record_proof_state_from_lineage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER task_record_proof_state_from_lineage AFTER INSERT OR UPDATE OF receipt_hash, signature, tenant_id, execution_id ON public.execution_lineage FOR EACH ROW EXECUTE FUNCTION public.sync_task_record_proof_state_from_lineage();


--
-- Name: tenants trg_log_tier_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_tier_change AFTER UPDATE OF tier ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.log_tier_change();


--
-- Name: fleet_agents update_fleet_agents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fleet_agents_updated_at BEFORE UPDATE ON public.fleet_agents FOR EACH ROW EXECUTE FUNCTION public.update_fleet_updated_at();


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: ai_capability_decision_audit ai_capability_decision_audit_envelope_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_capability_decision_audit
    ADD CONSTRAINT ai_capability_decision_audit_envelope_id_fkey FOREIGN KEY (envelope_id) REFERENCES public.ai_task_permission_audit(envelope_id) ON DELETE CASCADE;


--
-- Name: ai_credential_ref_audit ai_credential_ref_audit_envelope_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_credential_ref_audit
    ADD CONSTRAINT ai_credential_ref_audit_envelope_id_fkey FOREIGN KEY (envelope_id) REFERENCES public.ai_task_permission_audit(envelope_id) ON DELETE CASCADE;


--
-- Name: approval_requests approval_requests_decision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_requests
    ADD CONSTRAINT approval_requests_decision_id_fkey FOREIGN KEY (decision_id) REFERENCES public.action_policy_decisions(decision_id) ON DELETE CASCADE;


--
-- Name: boundary_violations boundary_violations_boundary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boundary_violations
    ADD CONSTRAINT boundary_violations_boundary_id_fkey FOREIGN KEY (boundary_id) REFERENCES public.execution_boundaries(boundary_id) ON DELETE SET NULL;


--
-- Name: devices devices_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: execution_boundaries execution_boundaries_policy_decision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_boundaries
    ADD CONSTRAINT execution_boundaries_policy_decision_id_fkey FOREIGN KEY (policy_decision_id) REFERENCES public.action_policy_decisions(decision_id) ON DELETE SET NULL;


--
-- Name: execution_context execution_context_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_context
    ADD CONSTRAINT execution_context_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_records(task_id) ON DELETE SET NULL;


--
-- Name: execution_eval_runs execution_eval_runs_eval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_eval_runs
    ADD CONSTRAINT execution_eval_runs_eval_id_fkey FOREIGN KEY (eval_id) REFERENCES public.execution_evals(eval_id) ON DELETE CASCADE;


--
-- Name: fleet_telemetry fk_agent; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fleet_telemetry
    ADD CONSTRAINT fk_agent FOREIGN KEY (agent_id) REFERENCES public.fleet_agents(agent_id) ON DELETE CASCADE;


--
-- Name: policy_proposal_events policy_proposal_events_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_proposal_events
    ADD CONSTRAINT policy_proposal_events_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.policy_proposals(proposal_id) ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON DELETE CASCADE;


--
-- Name: task_records task_records_latest_policy_decision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_records
    ADD CONSTRAINT task_records_latest_policy_decision_fkey FOREIGN KEY (latest_policy_decision_id) REFERENCES public.action_policy_decisions(decision_id) ON DELETE SET NULL;


--
-- Name: usage_log usage_log_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_log
    ADD CONSTRAINT usage_log_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.licenses(id) ON DELETE CASCADE;


--
-- Name: verification_results verification_results_policy_decision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_results
    ADD CONSTRAINT verification_results_policy_decision_id_fkey FOREIGN KEY (policy_decision_id) REFERENCES public.action_policy_decisions(decision_id) ON DELETE SET NULL;


--
-- Name: wal_checkpoints wal_checkpoints_policy_decision_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wal_checkpoints
    ADD CONSTRAINT wal_checkpoints_policy_decision_fkey FOREIGN KEY (policy_decision_id) REFERENCES public.action_policy_decisions(decision_id) ON DELETE SET NULL;


--
-- Name: wal_checkpoints wal_checkpoints_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wal_checkpoints
    ADD CONSTRAINT wal_checkpoints_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_records(task_id) ON DELETE CASCADE;


--
-- Name: licenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

--
-- Name: licenses licenses_tenant_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY licenses_tenant_insert ON public.licenses FOR INSERT WITH CHECK (((customer_id)::text = public.current_tenant_id()));


--
-- Name: licenses licenses_tenant_isolation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY licenses_tenant_isolation ON public.licenses USING (((customer_id)::text = public.current_tenant_id()));


--
-- PostgreSQL database dump complete
--

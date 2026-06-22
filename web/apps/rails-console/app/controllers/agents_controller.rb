# frozen_string_literal: true

# Agent Adoption Layer — the operator-first surface for understanding the
# agents in a tenant and the capabilities available to them. It sits ABOVE the
# execution engine: it does not run, route, recover, or prove anything. It only
# reads already-safe state from Go Overture and presents it.
#
# Three in-page views live under one Agents lens (mirrors the Runs lens, so no
# extra navigation):
#   - catalog   — the registered-agent roster with per-agent execution metrics
#   - packs     — the Action Pack catalog (available + installed)
#   - adoption  — onboarding health + the trust journey (getting started)
#
# Boundary / security: Rails never persists agent state and never sends
# tenant_id. No prompts, chain-of-thought, raw bodies, ciphertext, or secrets
# are ever rendered — only safe identifiers, labels, counts, and rates.
class AgentsController < ApplicationController
  VIEWS = %w[catalog packs adoption].freeze

  def index
    @view = VIEWS.include?(params[:view].to_s) ? params[:view].to_s : 'catalog'

    case @view
    when 'packs'
      @packs = data_source.action_packs
    when 'adoption'
      @health = data_source.adoption_health
    else
      @agents = data_source.agent_catalog
    end
    @degraded_error = data_source.error
  end

  def show
    @agent = data_source.find_agent(params[:id])
    if @agent.nil?
      return head :not_found unless data_source.error
      @agent = degraded_agent(params[:id])
    end

    # The id every agent-scoped read and investigation link keys on: the
    # registered agent's UUID when present, else the requested id.
    @agent_scope_id = @agent[:agent_id].presence || params[:id]
    @metrics = data_source.agent_metrics(@agent_scope_id)
    @affinity = data_source.agent_action_affinity(@agent_scope_id)
    @memory  = data_source.agent_memory_for_agent(@agent_scope_id)
    @recent_runs = recent_runs_from_memory(@memory)
    @degraded_error = data_source.error
  end

  def pack
    @pack = data_source.find_action_pack(params[:id])
    return head :not_found unless @pack

    @affinity = data_source.pack_affinity(@pack[:name])
    @degraded_error = data_source.error
  end

  # POST /agents/:id/archive — soft-archive an agent. Reads are unaffected for
  # other tenants; this only flips the agent's archived state in Go.
  def archive
    if data_source.fixtures?
      return redirect_to agents_path, alert: 'Demo mode — nothing was archived. Set OVERTURE_API_BASE_URL.'
    end

    data_source.archive_agent(params[:id])
    redirect_to agents_path, notice: 'Agent archived.'
  rescue Igris::OvertureClient::NotFound
    redirect_to agents_path, alert: 'Agent not found.'
  rescue Igris::OvertureClient::Error
    redirect_to agents_path, alert: 'Could not archive the agent right now.'
  end

  private

  # Recent runs the agent touched, derived from its Evidence Memory (each memory
  # row carries the task_id of the run it belongs to). This is the runs-with-
  # recorded-evidence view — honest about its source — and links straight to run
  # detail. De-duplicated by task_id, newest first, no extra backend calls.
  def recent_runs_from_memory(memory)
    Array(memory).filter_map do |m|
      task_id = m[:task_id].to_s
      next if task_id.empty?

      { task_id: task_id, outcome: m[:outcome_summary].to_s, at: m[:created_at] }
    end.uniq { |r| r[:task_id] }.first(8)
  end

  # A safe placeholder agent for the degraded detail page: only the id echoes
  # back; every other field is an honest empty value so the page renders without
  # crashing while the banner carries the safe error detail.
  def degraded_agent(id)
    {
      agent_id: id.to_s, name: '', display_name: '', agent_type: '',
      template_name: '', version: '', description: '',
      created_at: nil, updated_at: nil, archived: false, archived_at: nil,
    }
  end
end

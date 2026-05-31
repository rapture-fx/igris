class SettingsController < ApplicationController
  # Settings is the access/configuration center. It reads from the data source
  # so it can report mode/connection honestly and list the tenant's agent keys.
  # Nothing here echoes a secret value; agent keys show prefix-only metadata.

  # Canonical, documented section slugs. These are the names used in every link,
  # CTA, redirect, and doc — navigating to ?section=<slug> renders that section.
  SECTIONS = %w[
    project api_endpoints agent_keys runtime_keys
    target_access console_front_door environment advanced
  ].freeze

  # Backwards-compatible aliases for the short slugs the console shipped with, so
  # older bookmarks and external links never dead-end on the Project fallback.
  SECTION_ALIASES = {
    'api'       => 'api_endpoints',
    'access'    => 'agent_keys',
    'runtime'   => 'runtime_keys',
    'tools'     => 'target_access',
    'frontdoor' => 'console_front_door',
    'env'       => 'environment',
  }.freeze

  DEFAULT_SECTION = 'project'

  # Resolve a raw ?section= value to a canonical slug. Aliases are mapped first;
  # anything unknown falls back to the Project section (never a blank page).
  def self.normalize_section(raw)
    slug = raw.to_s
    slug = SECTION_ALIASES.fetch(slug, slug)
    SECTIONS.include?(slug) ? slug : DEFAULT_SECTION
  end

  def index
    @section = self.class.normalize_section(params[:section])
    load_settings
  end

  # POST /settings/api-keys — mint a read-once agent/app API key.
  #
  # The raw key lives only in @generated_agent_key for this single render and is
  # never written to the session, logs, or persisted in Rails. On refresh the
  # page shows only the prefix returned by the API.
  def create_api_key
    if data_source.fixtures?
      return redirect_to settings_path(section: 'agent_keys'),
                         notice: 'No live Igris API is connected, so no key was created.'
    end

    result = data_source.create_agent_api_key(params[:name])
    @generated_agent_key = result['api_key'] || result[:api_key]
    @section = 'agent_keys'
    load_settings
    flash.now[:notice] = 'API key created — copy it now. It is shown only once.'
    render :index
  rescue Igris::OvertureClient::ValidationError => e
    redirect_to settings_path(section: 'agent_keys'), alert: "Could not create the key: #{e.message}"
  rescue Igris::OvertureClient::Error => e
    redirect_to settings_path(section: 'agent_keys'), alert: "Could not create a key (HTTP #{e.status})."
  end

  # DELETE /settings/api-keys/:id — revoke an agent/app API key.
  def revoke_api_key
    if data_source.fixtures?
      return redirect_to settings_path(section: 'agent_keys'),
                         notice: 'No live Igris API is connected, so no key was changed.'
    end

    data_source.revoke_agent_api_key(params[:id])
    redirect_to settings_path(section: 'agent_keys'), notice: 'API key revoked.'
  rescue Igris::OvertureClient::NotFound
    redirect_to settings_path(section: 'agent_keys'), alert: 'That key no longer exists.'
  rescue Igris::OvertureClient::Error => e
    redirect_to settings_path(section: 'agent_keys'), alert: "Could not revoke the key (HTTP #{e.status})."
  end

  private

  def load_settings
    @section      ||= DEFAULT_SECTION
    @project        = helpers.project_context
    @degraded_error = data_source.error
    @agent_keys     = data_source.agent_api_keys
  end
end

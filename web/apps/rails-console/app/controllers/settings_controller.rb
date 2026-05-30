class SettingsController < ApplicationController
  # Settings is the access/configuration center. It reads from the data source
  # so it can report mode/connection honestly and list the tenant's agent keys.
  # Nothing here echoes a secret value; agent keys show prefix-only metadata.
  def index
    load_settings
  end

  # POST /settings/api-keys — mint a read-once agent/app API key.
  #
  # The raw key lives only in @generated_agent_key for this single render and is
  # never written to the session, logs, or persisted in Rails. On refresh the
  # page shows only the prefix returned by the API.
  def create_api_key
    if data_source.fixtures?
      return redirect_to settings_path(section: 'access'),
                         notice: 'Demo mode — connect a live Igris API to create a real key.'
    end

    result = data_source.create_agent_api_key(params[:name])
    @generated_agent_key = result['api_key'] || result[:api_key]
    @section_override = 'access'
    load_settings
    flash.now[:notice] = 'API key created — copy it now. It is shown only once.'
    render :index
  rescue Igris::OvertureClient::ValidationError => e
    redirect_to settings_path(section: 'access'), alert: "Could not create the key: #{e.message}"
  rescue Igris::OvertureClient::Error => e
    redirect_to settings_path(section: 'access'), alert: "Could not create a key (HTTP #{e.status})."
  end

  # DELETE /settings/api-keys/:id — revoke an agent/app API key.
  def revoke_api_key
    if data_source.fixtures?
      return redirect_to settings_path(section: 'access'),
                         notice: 'Demo mode — no real key was revoked.'
    end

    data_source.revoke_agent_api_key(params[:id])
    redirect_to settings_path(section: 'access'), notice: 'API key revoked.'
  rescue Igris::OvertureClient::NotFound
    redirect_to settings_path(section: 'access'), alert: 'That key no longer exists.'
  rescue Igris::OvertureClient::Error => e
    redirect_to settings_path(section: 'access'), alert: "Could not revoke the key (HTTP #{e.status})."
  end

  private

  def load_settings
    @project        = helpers.project_context
    @degraded_error = data_source.error
    @agent_keys     = data_source.agent_api_keys
  end
end

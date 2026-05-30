class RuntimesController < ApplicationController
  def index
    load_index
  end

  # POST /runtimes/api_key — mint a read-once runtime key.
  #
  # The raw key is held only in @generated_key for this single render and is
  # never written to the session, logs, or persisted in Rails. On refresh the
  # page shows only the prefix/status returned by the API.
  def create_key
    if data_source.fixtures?
      load_index
      flash.now[:notice] = 'Demo mode — connect a live Igris API to generate a real runtime key.'
      return render :index
    end

    result = data_source.create_runtime_api_key
    @generated_key = result['api_key'] || result[:api_key]
    load_index
    flash.now[:notice] = 'Runtime key created — copy it now. It is shown only once.'
    render :index
  rescue Igris::OvertureClient::Error => e
    load_index
    flash.now[:alert] = "Could not create a runtime key (#{e.status}): #{e.message}"
    render :index
  end

  private

  def load_index
    @runtimes        = data_source.runtimes
    @runtime_summary = data_source.runtime_summary
    @runtime_actions = data_source.local_runtime_actions
    @runtime_runs    = data_source.runtime_runs
    @action_names    = data_source.actions.map { |a| a[:name].to_s }.to_set
    @key_status      = data_source.runtime_api_key_status
    @degraded_error  = data_source.error
  end
end

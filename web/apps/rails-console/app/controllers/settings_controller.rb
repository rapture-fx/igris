class SettingsController < ApplicationController
  # Read-only configuration surface. We touch the data source once so the
  # "Connection" row can report degraded state honestly; nothing here writes.
  def index
    @degraded_error = data_source.error
  end
end

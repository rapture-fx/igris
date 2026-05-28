class RuntimesController < ApplicationController
  def index
    @runtimes = data_source.runtimes
    @degraded_error = data_source.error
  end
end

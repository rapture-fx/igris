# frozen_string_literal: true

# Connections — the operator-facing answer to "where does my work go?". It is a
# read-only, derived view over the actions a tenant already has: each connection
# is a destination an action routes to (a hosted API, a webhook, or the local
# runtime). No new backend, no stored state, no fabricated status — see
# Igris::DataSource#connections. Runtime keys and secrets are managed elsewhere
# (Runtimes / Settings); this page only links to them.
class ConnectionsController < ApplicationController
  def index
    @connections     = data_source.connections
    @runtime_summary = data_source.runtime_summary
    @degraded_error  = data_source.error
  end
end

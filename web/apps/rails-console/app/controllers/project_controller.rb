class ProjectController < ApplicationController
  # Single editable project identity for the current tenant. There is no
  # multi-project management here — just the name of the workspace that holds
  # this tenant's actions, runs, runtimes, keys, and evidence.
  #
  # The name is validated here (mirroring Go Overture's server-side rules so we
  # can show an inline error without a round-trip), then PATCHed through the
  # DataSource → OvertureClient → Go. Rails never persists it.

  # Mirrors validProjectName() in igris-overture/api/routes_frontend.go: 2–80
  # chars, letters/numbers/space and a small basic-punctuation allow-list. The
  # allow-list excludes <, >, /, = so HTML/script fragments are rejected.
  NAME_PATTERN = /\A[A-Za-z0-9 \-_'.,&]+\z/

  # Where the form lives, so we can bounce back to the right surface on error.
  SOURCES = %w[welcome settings].freeze

  def update
    name   = params[:name].to_s.strip
    source = SOURCES.include?(params[:source].to_s) ? params[:source].to_s : 'settings'

    if (err = name_error(name))
      return project_error(err, name, source)
    end

    # Fixture/demo mode never writes to a real backend — the name is inert.
    if data_source.fixtures?
      flash[:notice] = 'Demo mode — the project name is not saved. ' \
                       'Set OVERTURE_API_BASE_URL to name your project for real.'
      return redirect_to(source == 'welcome' ? welcome_path : settings_path(section: 'project'))
    end

    data_source.update_project(name)

    if source == 'welcome'
      # Naming the project completes first-run onboarding; continue to the
      # action wizard, the intended next step in the product loop.
      cookies.permanent[:igris_welcomed] = '1'
      redirect_to new_action_path, notice: "Project “#{name}” created."
    else
      redirect_to settings_path(section: 'project'), notice: 'Project name updated.'
    end
  rescue Igris::OvertureClient::ValidationError => e
    project_error("Igris rejected that name: #{e.message}", name, source)
  rescue Igris::OvertureClient::Error
    project_error('Could not save the project name right now. Try again in a moment.', name, source)
  end

  private

  def name_error(name)
    n = name.to_s.strip
    return 'Project name is required.' if n.empty?
    return 'Project name must be between 2 and 80 characters.' if n.length < 2 || n.length > 80
    unless n.match?(NAME_PATTERN)
      return 'Use letters, numbers, spaces, and basic punctuation only (no < > / =).'
    end
    nil
  end

  # Stash a safe inline error + the entered value and bounce back to the form.
  # The value is echoed so the user doesn't have to retype it; it is escaped on
  # render like any other user string.
  def project_error(message, name, source)
    flash[:project_error] = message
    flash[:project_name_value] = name if name.length <= 80
    redirect_to(source == 'welcome' ? welcome_path : settings_path(section: 'project'))
  end
end

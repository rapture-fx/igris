module ConsoleHelper
  # Lens detection mirrors web-console/components/console/IconRail.tsx#isActive.
  # Home is the onboarding/get-started lens (/welcome); Overview is the
  # everyday workspace (/home). The two share the icon rail with every other
  # lens.
  LENS_MATCHERS = {
    home:     %w[/welcome],
    overview: %w[/home],
    actions:  %w[/actions],
    runs:     %w[/runs],
    runtimes: %w[/runtimes],
    settings: %w[/settings],
  }.freeze

  def active_lens
    path = request.path
    LENS_MATCHERS.each do |lens, prefixes|
      return lens if prefixes.any? { |p| path == p || path.start_with?("#{p}/") }
    end
    nil
  end

  def active_lens?(lens)
    active_lens == lens
  end

  # ── Project identity ──────────────────────────────────────────────────
  # "Project" is the user-facing name for the workspace/tenant that holds the
  # actions, runs, runtimes, keys, and evidence. The name lives in Go; this
  # helper exposes it to every view through the DataSource boundary.
  #
  # Resilient on purpose: test doubles and any DataSource that predates the
  # project method fall back to a neutral context instead of raising, so the
  # chip never breaks a page.
  def project_context
    ds = data_source
    return ds.project if ds.respond_to?(:project)

    fixtures = ds.respond_to?(:fixtures?) && ds.fixtures?
    { name: nil, mode: fixtures ? :fixtures : :real, needs_name: false }
  rescue StandardError
    { name: nil, mode: :degraded, needs_name: false }
  end

  # The label to show in chips/headers. Falls back to a neutral sample name in
  # fixture mode and "igris-default" when a real project has no name yet.
  def project_display_name
    ctx = project_context
    return ctx[:name] if ctx[:name].present?

    ctx[:mode] == :fixtures ? 'Support Agent' : 'igris-default'
  end

  # Small project chip for page topbars. Plain, escaped, calm.
  def project_chip
    tag.span(project_display_name, class: 'ic-chip')
  end

  # Lucide-faithful icon set — same pack the landing-page hero uses
  # (lucide-react in web-landing/src/components/sections/Products.tsx).
  # Glyph paths copied from lucide.dev so visual identity matches.
  LUCIDE_PATHS = {
    'house'            => '<path d="M3 9.5 12 2l9 7.5"/><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M9 21v-6h6v6"/>',
    'layout-dashboard' => '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    'list-checks'      => '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
    'activity'         => '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.5.5 0 0 1-.96 0L9.24 2.18a.5.5 0 0 0-.96 0l-2.35 8.36A2 2 0 0 1 4 12H2"/>',
    'zap'              => '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    'box'              => '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    'settings'         => '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'user'             => '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    # Brand mark — Igris cross-hair. Not lucide; kept distinct on purpose.
    'igris-mark'       => '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
  }.freeze

  def console_icon(name, size: 14, stroke: 1.5)
    svg = LUCIDE_PATHS[name.to_s] || LUCIDE_PATHS['igris-mark']
    content_tag :svg, svg.html_safe,
      width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', 'stroke-width': stroke,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  end

  # ldrs LineSpinner — same loader library the landing-page hero uses
  # (ldrs/react LineSpinner in Products.tsx). Renders the `<l-line-spinner>`
  # web component that is auto-registered from the ESM CDN in the layout.
  def line_spinner(size: 14, stroke: 1.4, speed: 0.9, color: nil)
    color ||= 'rgb(52, 211, 153)' # emerald-400, matches landing's dark-mode hero
    content_tag('l-line-spinner', '',
                size: size, stroke: stroke, speed: speed, color: color)
  end

  # Status pill — picks a tone based on a string like "Proof verified" / "Ready".
  def status_pill(label, tone: nil)
    tone ||= infer_tone(label)
    tag.span(label, class: "ig-pill ig-pill--#{tone}")
  end

  def chip(label, tone: nil)
    if tone
      dot = tag.span('', class: "ig-chip__dot ig-chip__dot--#{tone}")
      tag.span(safe_join([dot, label.to_s]), class: 'ig-chip')
    else
      tag.span(label, class: 'ig-chip')
    end
  end

  # Small status glyphs for the Home activity feed — drawn so each event reads
  # like a notification (check / cross / spinner / alert) rather than a bare dot.
  FEED_GLYPHS = {
    ok:      '<path d="M5 12.5 L10 17 L19 7"/>',
    failed:  '<path d="M6 6 L18 18 M18 6 L6 18"/>',
    running: '<path d="M21 12a9 9 0 1 1-6.2-8.56"/>',
    warn:    '<path d="M12 8v5"/><path d="M12 16.5h.01"/>',
  }.freeze

  def feed_icon(tone, size: 12, stroke: 2.2)
    path = FEED_GLYPHS[tone.to_sym] || FEED_GLYPHS[:ok]
    content_tag :svg, path.html_safe,
      width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', 'stroke-width': stroke,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  end

  # Subtle trailing chevron on feed rows — reveals on hover via CSS.
  def feed_chevron
    content_tag :svg, '<path d="M9 6 L15 12 L9 18"/>'.html_safe,
      class: 'ic-feed-item__chev', width: 13, height: 13, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  end

  # Tone for a normalized runtime status label (Healthy / Stale / Degraded /
  # Offline / anything else). Used to colour the connected-runtime rows.
  def runtime_status_tone(status)
    case status.to_s
    when 'Healthy'           then :ok
    when 'Stale', 'Degraded' then :warn
    when 'Offline'           then :bad
    else                          :muted
    end
  end

  # ── Run categorization — shared by the Runs controller (filters/counts)
  # and the Runs views (row styling). Operate on a normalized run hash. ──
  def run_failed?(run)  = run[:status].to_s.casecmp('Failed').zero?
  def run_running?(run) = run[:status].to_s.casecmp('Running').zero?

  # Proof has not been (or cannot be) established yet.
  def run_proof_unavailable?(run)
    run[:proof].to_s.match?(/unavailable|pending/i)
  end

  # A run a developer should look at: it failed, its proof failed, or its
  # recovery is unresolved.
  def run_needs_attention?(run)
    run_failed?(run) ||
      run[:proof].to_s.casecmp('Proof failed').zero? ||
      run[:recovery].to_s.match?(/awaiting|failed/i)
  end

  # Tone token (ok / running / failed) for a run's status dot + caps.
  def run_tone(run)
    return 'running' if run_running?(run)
    return 'failed'  if run_failed?(run)
    'ok'
  end

  # ── Run Activity Map ───────────────────────────────────────────────────
  # An at-a-glance, time-ordered map of recent runs on /runs. Each run is one
  # dot; its outcome band (not a numeric value) and tone show what happened.
  # Pure presentation: it reads only the already-normalized, already-redacted
  # run summary fields — never raw bodies, signatures, hosts, or env values.
  #
  # Bands run top→bottom from best to worst outcome, mirroring the "rising on
  # top / falling on bottom" shape of the reference visualization.
  RUN_ACTIVITY_BANDS = [
    { key: :verified,  label: 'Verified' },
    { key: :completed, label: 'Completed' },
    { key: :recovered, label: 'Recovered' },
    { key: :waiting,   label: 'Waiting' },
    { key: :blocked,   label: 'Blocked' },
    { key: :failed,    label: 'Failed' },
  ].freeze

  # Map a normalized run to its outcome band. Ordered so an in-flight or
  # blocked run is never mislabelled as a clean completion, and so we never
  # assert proof that isn't there.
  def run_activity_band(run)
    status   = run[:status].to_s
    proof    = run[:proof].to_s
    recovery = run[:recovery].to_s

    # Not yet resolved — running, pending dispatch, or awaiting approval.
    return :waiting if status.match?(/running|awaiting|pending|in.?flight/i)

    # Stopped or withheld before a clean completion. This is actionable, and
    # deliberately distinct from a hard failure: policy/replay block, a failed
    # recovery, a cancel, or a local-runtime run that never bound a runtime.
    return :blocked if run[:runtime_unavailable] ||
                       recovery.match?(/recovery failed/i) ||
                       status.match?(/denied|blocked|cancel/i) ||
                       (status.match?(/failed/i) &&
                        run[:executed_target].to_s == 'local_runtime' &&
                        run[:runtime_id].to_s.strip.empty?)

    return :failed if status.match?(/failed|error/i)

    # Proof-verified completion is the strongest positive signal we can show.
    return :verified if proof.match?(/verified/i)

    # Retried / compensated / resumed / replayed and then completed.
    return :recovered if recovery.match?(/retr|compensat|resum|replay/i)

    return :completed if status.match?(/succeeded|success|completed/i)

    # Indeterminate (e.g. empty status) — honest Waiting, never a fake success.
    :waiting
  end

  # Ordered band descriptors, exposed as a method so views can iterate them
  # (the bare constant isn't resolvable from a compiled ERB template).
  def run_activity_bands = RUN_ACTIVITY_BANDS

  # Human label for a band key.
  def run_activity_label(band)
    RUN_ACTIVITY_BANDS.find { |b| b[:key] == band }&.dig(:label) || 'Run'
  end

  # Accessible / tooltip summary for a single run dot. Only safe identifiers
  # and normalized labels — no raw evidence.
  def run_activity_aria_label(run, band = nil)
    band ||= run_activity_band(run)
    parts = ["Action #{run[:action].to_s.presence || '—'}", run_activity_label(band)]
    parts << "routed via #{run[:routed_via]}" if run[:routed_via].to_s.strip.present?
    parts << (run[:proof].to_s.presence || 'Proof unavailable')
    parts << "runtime #{run[:runtime_id]}"    if run[:runtime_id].to_s.strip.present?
    parts << time_ago(run[:started_at])
    "#{parts.join(' · ')}. Open run to inspect audit-supporting evidence."
  end

  # Build the placed points for the map from a newest-first run window.
  # Capped to the latest `limit`, then reversed so time reads left→right
  # (oldest→newest). Each point carries its grid column/row (1-based; column 1
  # is reserved for band labels) so the view can position it without JS.
  def run_activity_points(runs, limit: 80)
    ordered  = Array(runs).first(limit).reverse
    band_row = RUN_ACTIVITY_BANDS.each_with_index.to_h { |b, i| [b[:key], i + 1] }
    ordered.each_with_index.map do |run, i|
      band = run_activity_band(run)
      {
        run:  run,
        band: band,
        col:  i + 2,
        row:  band_row[band] || RUN_ACTIVITY_BANDS.length,
        aria: run_activity_aria_label(run, band),
      }
    end
  end

  # ── Run Activity Map — diverging skyline ────────────────────────────────
  # Each resolved run is one box placed by outcome *tier* on a diverging axis:
  # healthy outcomes rise above the centre line, failing ones fall below it,
  # mirroring the "winners and losers" reference layout. Indeterminate runs
  # (running / awaiting / pending) carry no signed outcome yet, so they sit in
  # a separate "in progress" lane below the axis rather than faking a result.
  #
  #   tier  +3 verified   (strongest positive — top, blue)
  #         +2 completed  (green)
  #         +1 recovered  (pale green, nearest centre)
  #        ── centre baseline (0) ──
  #         -1 blocked    (amber, nearest centre)
  #         -2 failed     (red — bottom)
  RUN_ACTIVITY_TIERS = {
    verified:  3,
    completed: 2,
    recovered: 1,
    blocked:  -1,
    failed:   -2,
  }.freeze

  # Default dimensions for callers that need map geometry before a skyline is
  # available. Rendered maps use the actual skyline stack sizes.
  RUN_ACTIVITY_DEFAULT_MAX_UP = 3
  RUN_ACTIVITY_DEFAULT_MAX_DOWN = 2

  # Bucket a newest-first window into time-ordered columns and *stack* each
  # column: healthy runs pile upward from the centre line, failing runs pile
  # downward — exactly the "winners and losers" skyline. In-progress runs carry
  # no signed outcome, so they sit in a separate lane below. Each box also
  # carries an exact colour interpolated from the diverging ramp by its score.
  #
  # Returns { points:, inprog:, cols:, max_up:, max_down:, n: }. A point's
  # :signed row is +k (k-th box up) or -k (k-th box down); the view turns that
  # into a grid row using the centre line at max_up + 1.
  def run_activity_skyline(runs, limit: 80, columns: nil)
    ordered = Array(runs).first(limit).reverse # oldest → newest
    n = ordered.size
    return { points: [], inprog: [], cols: 0, max_up: 0, max_down: 0, n: 0 } if n.zero?

    cols = columns || [[(n / 5.0).ceil, 1].max, 48].min
    cols = [cols, n].min

    buckets = Array.new(cols) { [] }
    ordered.each_with_index do |run, i|
      ci = cols == 1 ? 0 : ((i.to_f / (n - 1)) * (cols - 1)).round
      buckets[ci] << run
    end

    points = []
    inprog = []
    max_up = 0
    max_down = 0

    buckets.each_with_index do |bucket, bi|
      col = bi + 1
      ups = []
      downs = []
      bucket.each do |run|
        band = run_activity_band(run)
        polarity = RUN_ACTIVITY_TIERS[band].to_i
        if polarity > 0
          ups << [run, band]
        elsif polarity < 0
          downs << [run, band]
        else
          inprog << { run: run, col: col, aria: run_activity_aria_label(run, band) }
        end
      end
      # Strongest colour sits at the outer end of each stack (top / bottom).
      ups   = ups.sort_by   { |run, band| run_activity_score(run, band) }
      downs = downs.sort_by { |run, band| -run_activity_score(run, band) }
      ups.each_with_index   { |(run, band), k| points << skyline_point(run, band, col,  (k + 1)) }
      downs.each_with_index { |(run, band), k| points << skyline_point(run, band, col, -(k + 1)) }
      max_up   = ups.size   if ups.size   > max_up
      max_down = downs.size if downs.size > max_down
    end

    centre_row = run_activity_centre_row(max_up: max_up, max_down: max_down)
    points.each { |pt| pt[:row] = centre_row - pt[:signed] }

    { points: points, inprog: inprog, cols: cols, max_up: max_up, max_down: max_down, n: n }
  end

  def run_activity_total_rows(skyline = nil, max_up: nil, max_down: nil)
    max_up ||= skyline&.fetch(:max_up, nil) || RUN_ACTIVITY_DEFAULT_MAX_UP
    max_down ||= skyline&.fetch(:max_down, nil) || RUN_ACTIVITY_DEFAULT_MAX_DOWN
    [max_up.to_i, 1].max + 1 + [max_down.to_i, 1].max
  end

  def run_activity_centre_row(skyline = nil, max_up: nil, max_down: nil)
    max_up ||= skyline&.fetch(:max_up, nil) || RUN_ACTIVITY_DEFAULT_MAX_UP
    [max_up.to_i, 1].max + 1
  end

  def run_activity_axis_ticks(skyline, runs)
    cols = [skyline[:cols].to_i, 1].max
    ordered = Array(runs).first(skyline[:n].to_i).reverse
    return [] if ordered.empty?

    tick_count = [5, cols].min
    (0...tick_count).map do |i|
      idx = tick_count == 1 ? 0 : ((i.to_f / (tick_count - 1)) * (ordered.size - 1)).round
      col = tick_count == 1 ? 1 : ((i.to_f / (tick_count - 1)) * (cols - 1)).round + 1
      started_at = ordered[idx][:started_at]
      label = started_at.respond_to?(:strftime) ? started_at.strftime('%b %d') : time_ago(started_at)
      { col: col, label: label }
    end
  end

  # One placed skyline box.
  def skyline_point(run, band, col, signed)
    {
      run:    run,
      band:   band,
      col:    col,
      signed: signed,
      color:  run_activity_color(run_activity_score(run, band)),
      aria:   run_activity_aria_label(run, band),
    }
  end

  # A run's outcome score on a continuous diverging axis, −1 (worst) … +1
  # (best). The band sets the base; concrete signals (recovery effort, latency)
  # nudge it so same-band runs read as distinct shades rather than one flat
  # colour — mirroring the reference's per-box gradation.
  RUN_ACTIVITY_BASE_SCORE = {
    verified:  0.85, completed: 0.45, recovered: 0.20,
    waiting:   0.0,  blocked:  -0.45, failed:   -0.85,
  }.freeze

  def run_activity_score(run, band = nil)
    band ||= run_activity_band(run)
    score = RUN_ACTIVITY_BASE_SCORE[band] || 0.0
    score -= 0.12 if run[:recovery].to_s.match?(/retr|compensat|resum|replay/i)
    ms = run[:duration_ms].to_i
    if score > 0 && ms.positive?
      score += 0.08 if ms < 300       # fast, clean success → deeper blue
      score -= 0.08 if ms > 2_000     # slow success → pull back toward green
    elsif score < 0 && ms > 4_000
      score -= 0.05                   # long failure → deeper red
    end
    score.clamp(-1.0, 1.0)
  end

  # Diverging colour ramp stops (value → RGB), failing (red) → neutral → healthy
  # (blue). Interpolated per run so each box gets its own shade.
  RUN_ACTIVITY_RAMP_STOPS = [
    [-1.0, [0xb2, 0x18, 0x2b]], # deep red
    [-0.6, [0xe0, 0x50, 0x3a]], # red
    [-0.3, [0xf4, 0xa6, 0x4c]], # amber
    [ 0.0, [0xec, 0xe7, 0xd5]], # pale neutral
    [ 0.3, [0xb6, 0xdf, 0x7e]], # pale green
    [ 0.6, [0x5c, 0xb8, 0x5c]], # green
    [ 1.0, [0x3f, 0x8f, 0xd0]], # blue
  ].freeze

  # Interpolate a hex colour for a score in [-1, 1] across the ramp stops.
  def run_activity_color(score)
    s = score.to_f.clamp(-1.0, 1.0)
    RUN_ACTIVITY_RAMP_STOPS.each_cons(2) do |(v0, c0), (v1, c1)|
      next unless s >= v0 && s <= v1
      t = (v1 - v0).zero? ? 0.0 : (s - v0) / (v1 - v0)
      rgb = c0.zip(c1).map { |a, b| (a + (b - a) * t).round }
      return format('#%02x%02x%02x', *rgb)
    end
    rgb = (s <= RUN_ACTIVITY_RAMP_STOPS.first[0] ? RUN_ACTIVITY_RAMP_STOPS.first : RUN_ACTIVITY_RAMP_STOPS.last)[1]
    format('#%02x%02x%02x', *rgb)
  end

  # CSS gradient string for the legend bar, built from the same ramp stops so
  # the scale and the boxes always agree.
  def run_activity_ramp_css
    stops = RUN_ACTIVITY_RAMP_STOPS.map do |val, rgb|
      pct = ((val + 1.0) / 2.0 * 100).round
      "#{format('#%02x%02x%02x', *rgb)} #{pct}%"
    end
    "linear-gradient(to right, #{stops.join(', ')})"
  end

  # The single most useful next step for a run, used by Run Detail's
  # "What to do next" panel. Returns a state token; the view renders the
  # matching message + CTAs. Ordered by urgency so a runtime-unavailable
  # failure is never masked by the generic "failed" branch.
  def run_guidance_state(run)
    return :runtime_unavailable if run[:runtime_unavailable]
    return :failed              if run_failed?(run)
    return :running             if run_running?(run)
    return :proof_unavailable   if run_proof_unavailable?(run)
    return :completed           if run[:status].to_s.casecmp('Succeeded').zero?
    nil
  end

  # ── Run Inspector ──────────────────────────────────────────────────────
  # The drawer is opened by an `inspect=<run_id>` query param and must preserve
  # the active filter (and any other query params) so opening/closing it never
  # drops the list context. These build the param hashes for the links.
  def runs_inspect_params(run_id)
    request.query_parameters.except('inspect').merge('inspect' => run_id.to_s)
  end

  def runs_close_params
    request.query_parameters.except('inspect')
  end

  # True when the given run is the one currently open in the inspector.
  def run_selected?(run, selected_id)
    selected_id.present? && run[:id].to_s == selected_id.to_s
  end

  # Plain-language execution assessment for the Run Inspector. Reads only the
  # already-normalized, already-redacted run fields (status, policy, routed_via,
  # recovery, proof) — never raw bodies, failure text, hosts, or signatures.
  # Each row is { label:, value:, tone: } with text values (never colour-only):
  # Yes / No / Allowed / Denied / Not available, etc.
  def run_execution_assessment(run)
    [
      { label: 'Action completed', **assess_completed(run) },
      { label: 'Policy followed',  **assess_policy(run) },
      { label: 'Runtime path',     **assess_runtime_path(run) },
      { label: 'Recovery',         **assess_recovery(run) },
      { label: 'Proof',            **assess_proof(run) },
    ]
  end

  def assess_completed(run)
    status = run[:status].to_s
    return { value: 'Yes', tone: :ok }            if status.match?(/succeeded|success|completed/i)
    return { value: 'No', tone: :bad }            if status.match?(/failed|error/i)
    return { value: 'Running', tone: :warn }      if run_running?(run)
    return { value: 'Awaiting approval', tone: :warn } if status.match?(/approval|awaiting/i)
    { value: 'Not available', tone: :muted }
  end

  # We never receive a raw allow/deny verdict, but execution is itself evidence
  # the policy permitted the call: a run that routed to a target or reached a
  # terminal state passed policy. Denials/holds are surfaced from the status.
  def assess_policy(run)
    status = run[:status].to_s
    return { value: 'Approval required', tone: :warn } if status.match?(/approval|awaiting/i)
    return { value: 'Denied', tone: :bad }             if status.match?(/denied|blocked/i)
    if run[:executed_target].to_s.present? || status.match?(/succeeded|success|completed|failed|running|in.?flight/i)
      return { value: 'Allowed', tone: :ok }
    end
    { value: 'Not available', tone: :muted }
  end

  def assess_runtime_path(run)
    case run[:executed_target].to_s
    when 'hosted_api'    then { value: 'Hosted API', tone: :muted }
    when 'webhook'       then { value: 'Webhook', tone: :muted }
    when 'local_runtime' then { value: 'Local runtime', tone: run[:runtime_id].to_s.present? ? :ok : :warn }
    when 'mock_demo'     then { value: 'Mock demo', tone: :muted }
    else { value: 'Not available', tone: :muted }
    end
  end

  def assess_recovery(run)
    rec = run[:recovery].to_s
    return { value: 'Not available', tone: :muted } if rec.empty?
    return { value: 'Not needed', tone: :muted }    if rec.casecmp('Not needed').zero?
    return { value: rec, tone: :bad }               if rec.match?(/failed/i)
    return { value: rec, tone: :warn }              if rec.match?(/awaiting/i)
    { value: rec, tone: :ok } # retried / compensated / resumed
  end

  def assess_proof(run)
    proof = run[:proof].to_s
    return { value: 'Verified', tone: :ok }   if proof.match?(/verified/i)
    return { value: 'Failed', tone: :bad }    if proof.match?(/failed|mismatch/i)
    return { value: 'Receipt present', tone: :warn } if proof.match?(/present|receipt/i)
    { value: 'Not available', tone: :muted }
  end

  # Small inline "copy this value" button. Reuses the same clipboard pattern
  # as the code-snippet card. The value is only ever a safe identifier
  # (run/task id) — never a secret.
  def copy_button(value, label: 'Copy')
    content_tag :button, label, type: 'button', class: 'ic-copy',
      data: { code: value.to_s },
      onclick: "(()=>{navigator.clipboard.writeText(this.dataset.code);" \
               "this.textContent='Copied';setTimeout(()=>this.textContent='#{label}',1400)})()"
  end

  # Plain-language, audit-supporting reading of a run's already-safe evidence
  # fields. Interpretation ONLY: it never asserts legal/regulatory compliance
  # or certification, and reads exclusively from redacted/normalized values
  # (status, policy, proof label, recovery) — never raw bodies or signatures.
  def audit_interpretation(run)
    proof    = run[:proof].to_s
    verified = proof.match?(/verified/i)
    failed   = proof.match?(/failed|mismatch/i)
    verification =
      if    verified then 'Signed'
      elsif failed   then 'Signature mismatch'
      else                'Unsigned · not attached'
      end

    [
      { label: 'Control decision', value: run[:policy].to_s.presence || '—',
        note: 'Policy decision record — the policy preset Igris applied before allowing execution.' },
      { label: 'Execution record', value: run[:status].to_s.presence || '—',
        note: 'Tamper-evident record of what Igris did when the action was called.' },
      { label: 'Evidence receipt', value: audit_receipt_value(proof),
        note: 'A receipt is a signed, tamper-evident record that a runtime reported this execution event.' },
      { label: 'Verification status', value: verification,
        note: 'Signature shows the event was reported by a registered runtime key when available. ' \
              'Digest records prove data consistency without exposing raw input or output.' },
      { label: 'Recovery / replay status', value: run[:recovery].to_s.presence || 'Not needed',
        note: 'Replay / recovery record — whether Igris retried or compensated the action.' },
      { label: 'Data exposure', value: 'Minimized',
        note: 'Raw inputs/outputs are not shown here; only safe identifiers and digests are displayed.' },
    ]
  end

  def audit_receipt_value(proof)
    case proof.to_s
    when /verified/i        then 'Signed runtime evidence present'
    when /failed|mismatch/i then 'Receipt withheld — signature mismatch'
    when /present|receipt/i then 'Receipt present'
    else 'No signed runtime evidence attached'
    end
  end

  def infer_tone(label)
    case label.to_s
    when /verified|ready|success|healthy|completed|connected/i then :ok
    when /failed|error|mismatch|expired|unavailable/i          then :bad
    when /needs|pending|warning|stale|coming soon/i            then :warn
    else :muted
    end
  end

  def code_snippet(code, language: 'bash', label: nil)
    render 'shared/code_snippet', code: code, language: language, label: label
  end

  # Inline test-run outcome → { tone:, label: } for the Action Detail "Test
  # this action" panel. The `state` strings are produced by
  # ActionsController#run; messages themselves are operator-facing copy only.
  def test_result_meta(state)
    case state.to_s
    when 'demo'                            then { tone: :warn, label: 'Demo mode' }
    when 'sent'                            then { tone: :warn, label: 'Accepted' }
    when 'invalid_json', 'invalid_request' then { tone: :bad,  label: 'Request rejected' }
    when 'policy_denied'                   then { tone: :bad,  label: 'Policy denied' }
    when 'runtime_unavailable'             then { tone: :bad,  label: 'Runtime unavailable' }
    when 'unavailable', 'api_error'        then { tone: :bad,  label: 'Igris unavailable' }
    else { tone: :muted, label: 'Result' }
    end
  end

  # Sample JSON request body for the "Test this action" panel, shaped to match
  # the action's target type. Purely a starting point the developer can edit —
  # Igris owns what actually runs.
  SAMPLE_PAYLOADS = {
    'mock_demo'     => { input: { message: 'Hello from Igris' } },
    'hosted_api'    => { input: { method: 'POST', body: { message: 'Hello from Igris' } } },
    'webhook'       => { input: { event: 'test.action', payload: { message: 'Hello from Igris' } } },
    'local_runtime' => { input: { operation: 'read_file', path_label: 'example.txt' } },
  }.freeze

  def sample_payload_for(target_type)
    body = SAMPLE_PAYLOADS[target_type.to_s] || SAMPLE_PAYLOADS['mock_demo']
    JSON.pretty_generate(body)
  end

  # Endpoint URL for an action name. Mirrors DataSource#endpoint_url so views
  # that only have a name (e.g. the wizard draft) stay consistent.
  def action_endpoint_url(name)
    base = ENV['OVERTURE_PUBLIC_API_URL'].presence || 'https://api.igrisinertial.com'
    "#{base.chomp('/')}/v1/actions/#{name}/run"
  end

  # curl snippet for an action endpoint with a JSON body.
  def action_curl_snippet(endpoint, body = %({ "input": {} }))
    <<~CURL.strip
      curl -X POST #{endpoint} \\
        -H "Authorization: Bearer $IGRIS_API_KEY" \\
        -H "Content-Type: application/json" \\
        -d '#{body}'
    CURL
  end

  # JavaScript fetch snippet for an action endpoint with a JSON body.
  def action_js_snippet(endpoint)
    <<~JS.strip
      await fetch('#{endpoint}', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.IGRIS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: {} }),
      })
    JS
  end

  # Runs pulse — daily activity as thin vertical bars with a soft 7-day
  # moving-average curve overlay, week-boundary tick marks, and a "today"
  # pin on the last column. Original to the Igris console.
  def runs_pulse(series, height: 96, bar_w: 4, gap: 2)
    series = Array(series).map(&:to_i)
    return ''.html_safe if series.empty?

    today      = Date.today
    start_date = today - (series.length - 1)
    n          = series.length
    max        = [series.max, 1].max
    pad_x      = 4
    pad_t      = 6
    pad_b      = 18                       # leaves room for week ticks + today pin
    inner_h    = height - pad_t - pad_b
    total_w    = pad_x * 2 + n * (bar_w + gap) - gap

    bar_x = ->(i) { pad_x + i * (bar_w + gap) }
    bar_h = ->(v) { (v.to_f / max * inner_h).round(2).clamp(0, inner_h) }

    # Centered 7-day moving average so the trend curve sits "inside" the bars.
    window = 7
    half   = window / 2
    avgs = (0...n).map do |i|
      lo = [i - half, 0].max
      hi = [i + half, n - 1].min
      slice = series[lo..hi]
      slice.sum.to_f / slice.length
    end

    points = avgs.each_with_index.map do |a, i|
      x = bar_x.call(i) + bar_w / 2.0
      y = pad_t + inner_h - (a / max * inner_h)
      [x.round(2), y.round(2)]
    end
    curve_path = points.each_with_index.map { |(x, y), i| "#{i.zero? ? 'M' : 'L'} #{x} #{y}" }.join(' ')

    base_y = pad_t + inner_h
    leading = start_date.wday
    last_x  = bar_x.call(n - 1) + bar_w / 2.0
    last_y  = pad_t + inner_h - bar_h.call(series.last)

    svg = +%(<svg class="ic-pulse" viewBox="0 0 #{total_w} #{height}" )
    svg << %(width="100%" height="#{height}" preserveAspectRatio="xMaxYMid meet" )
    svg << %(xmlns="http://www.w3.org/2000/svg" role="img" )
    svg << %(aria-label="Daily run activity, last #{n} days">)

    # Subtle axis baseline
    svg << %(<line class="ic-pulse__axis" x1="#{pad_x}" x2="#{total_w - pad_x}" )
    svg << %(y1="#{base_y}" y2="#{base_y}"/>)

    # Week-boundary tick marks below the axis (every 7 days)
    (0...n).each do |i|
      d = start_date + i
      next unless d.wday.zero?                 # ticks on Sundays
      x = bar_x.call(i) + bar_w / 2.0
      svg << %(<line class="ic-pulse__tick" x1="#{x}" x2="#{x}" )
      svg << %(y1="#{base_y}" y2="#{base_y + 4}"/>)
      # Month label only on the first Sunday of each month
      if d.day <= 7
        svg << %(<text class="ic-pulse__label" x="#{x + 2}" y="#{base_y + 13}">)
        svg << %(#{d.strftime('%b').downcase}</text>)
      end
    end

    # Bars
    series.each_with_index do |v, i|
      next if v <= 0
      x = bar_x.call(i)
      h = bar_h.call(v)
      y = base_y - h
      svg << %(<rect class="ic-pulse__bar" x="#{x}" y="#{y}" )
      svg << %(width="#{bar_w}" height="#{h}" rx="1.5" ry="1.5">)
      date_label = (start_date + i).strftime('%b %-d')
      svg << %(<title>#{v} run#{'s' if v != 1} on #{date_label}</title></rect>)
    end

    # Moving-average curve (drawn on top, semi-transparent)
    svg << %(<path class="ic-pulse__avg" d="#{curve_path}" fill="none"/>)

    # Today pin: vertical stem + dot at the top of today's bar
    svg << %(<line class="ic-pulse__pin" x1="#{last_x}" x2="#{last_x}" )
    svg << %(y1="#{last_y - 6}" y2="#{base_y}"/>)
    svg << %(<circle class="ic-pulse__pin-dot" cx="#{last_x}" cy="#{last_y - 6}" r="2.5"/>)
    svg << %(<text class="ic-pulse__pin-label" x="#{last_x}" y="#{last_y - 11}" )
    svg << %(text-anchor="middle">today</text>)

    svg << '</svg>'
    svg.html_safe
  end
end

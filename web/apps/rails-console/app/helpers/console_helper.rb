module ConsoleHelper
  # Lens detection mirrors web-console/components/console/IconRail.tsx#isActive.
  LENS_MATCHERS = {
    home:     %w[/home],
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

  # Lucide-faithful icon set — same pack the landing-page hero uses
  # (lucide-react in web-landing/src/components/sections/Products.tsx).
  # Glyph paths copied from lucide.dev so visual identity matches.
  LUCIDE_PATHS = {
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

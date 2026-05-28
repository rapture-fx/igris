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

  # Small inline SVGs so the spike has no icon dependencies. Roughly matches
  # the Lucide glyphs used by IconRail (Home, Workflow, Zap, Box, Settings).
  def console_icon(name)
    case name.to_s
    when 'home'
      svg = '<path d="M3 12 12 4l9 8"/><path d="M5 10v10h14V10"/>'
    when 'workflow'
      svg = '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M6 9v4a3 3 0 0 0 3 3h6"/>'
    when 'zap'
      svg = '<path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z"/>'
    when 'box'
      svg = '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>'
    when 'settings'
      svg = '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"/>'
    else
      svg = '<circle cx="12" cy="12" r="9"/>'
    end
    content_tag :svg, svg.html_safe,
      width: 20, height: 20, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
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
end

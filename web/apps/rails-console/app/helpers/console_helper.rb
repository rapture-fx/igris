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

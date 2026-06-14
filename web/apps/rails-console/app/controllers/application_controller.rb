class ApplicationController < ActionController::Base
  include ConsoleAuthentication

  helper_method :time_ago, :data_source, :demo_mode?
  protect_from_forgery with: :exception

  public

  def time_ago(time)
    return 'never' unless time
    delta = (Time.now - time).to_i
    case delta
    when 0..59          then "#{delta}s ago"
    when 60..3599       then "#{delta / 60}m ago"
    when 3600..86_399   then "#{delta / 3600}h ago"
    else                     "#{delta / 86_400}d ago"
    end
  end

  def demo_mode?
    data_source.fixtures?
  end
end
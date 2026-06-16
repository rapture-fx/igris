Rails.application.routes.draw do
  # Root sends new visitors to /home (onboarding) until they've entered the
  # console (cookie `igris_welcomed=1`). After that, it goes to /overview.
  root to: 'home#root'

  get '/home', to: 'home#index', as: :home
  post '/home/enter', to: 'home#enter', as: :enter_console
  post '/home/reset', to: 'home#reset', as: :reset_onboarding

  get '/overview', to: 'overview#index', as: :overview

  # Legacy /welcome URLs redirect to /home.
  get '/welcome', to: 'welcome#index', as: :welcome
  post '/welcome/enter', to: 'welcome#enter'
  post '/welcome/reset', to: 'welcome#reset'

  # Landing auth compatibility — stable URLs used by web-landing AuthForm and OAuth
  # callbacks. /welcome and /home are the canonical console destinations.
  get '/onboarding', to: 'auth_redirects#onboarding'
  get '/dashboard', to: 'auth_redirects#dashboard'
  get '/reset-password', to: 'password_resets#show', as: :reset_password

  # BetterAuth API — proxied to BETTER_AUTH_UPSTREAM_URL (e.g. landing /api/auth).
  match '/api/auth/*path', to: 'auth_proxy#forward', via: :all, format: false

  # Single project identity for this tenant — name only (no multi-project
  # management). The naming form lives on /home (first run) and in Settings.
  patch '/project', to: 'project#update', as: :project

  resources :actions, only: %i[index new create show] do
    member do
      post :run
    end
  end

  resources :runs, only: %i[index show]
  resources :runtimes, only: :index do
    collection do
      post :api_key, to: 'runtimes#create_key'
    end
  end
  resources :settings, only: :index
  # Agent / app API key management (read-once create + revoke). Backed by Go;
  # Rails never persists keys.
  post   '/settings/api-keys',     to: 'settings#create_api_key', as: :settings_api_keys
  delete '/settings/api-keys/:id', to: 'settings#revoke_api_key', as: :settings_api_key

  # Health
  get '/up', to: ->(_env) { [200, { 'Content-Type' => 'text/plain' }, ['ok']] }
end

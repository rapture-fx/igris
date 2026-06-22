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

  # Execution Evaluation definitions live under the Runs lens (no new top-level
  # nav). Declared BEFORE `resources :runs` so /runs/evaluations resolves here
  # and never collides with runs#show (GET /runs/:id).
  scope path: 'runs' do
    resources :evaluations, controller: 'execution_evaluations',
              only: %i[index new create show edit update destroy] do
      member do
        post :run
      end
    end

    # Policy Proposal lifecycle — save a simulated rule as a draft, re-simulate
    # it, mark it ready, and approve it. Governance only: nothing here mutates
    # active policy. Lives under the Runs lens (no new top-level navigation) and
    # is declared BEFORE `resources :runs` so /runs/proposals never collides with
    # runs#show (GET /runs/:id).
    resources :proposals, controller: 'policy_proposals',
              only: %i[index new create show edit update destroy] do
      member do
        post :simulate
        post :approve
        post :ready
      end
    end
  end

  # Agent Adoption Layer — the operator home for registered agents and the
  # capabilities (action packs) available to them. Catalog / Packs / Getting
  # started live as in-page views under one Agents lens (mirrors the Runs lens),
  # so no navigation beyond the single rail item. Agent detail is /agents/:id;
  # archive is a member POST (Go soft-archives via DELETE /v1/agents).
  get '/agents/packs/:id', to: 'agents#pack', as: :agent_pack
  resources :agents, only: %i[index show] do
    member do
      post :archive
    end
  end

  # Trust Recommendation lifecycle (acknowledge/snooze/resolve/reactivate). Lives
  # under the Runs > Intelligence surface; POST-only triage action.
  post '/runs/trust-recommendations/state', to: 'trust_recommendations#update', as: :trust_recommendation_state

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

Rails.application.routes.draw do
  # Root sends new visitors to the onboarding /welcome page until they've
  # entered the console (cookie `igris_welcomed=1`). After that, it goes
  # straight to /home.
  root to: 'welcome#root'

  get '/welcome', to: 'welcome#index', as: :welcome
  post '/welcome/enter', to: 'welcome#enter', as: :enter_console
  post '/welcome/reset', to: 'welcome#reset', as: :reset_onboarding

  get '/home', to: 'home#index', as: :home

  # Single project identity for this tenant — name only (no multi-project
  # management). The naming form lives on /welcome (first run) and in Settings.
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

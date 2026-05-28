Rails.application.routes.draw do
  # Root sends new visitors to the onboarding /welcome page until they've
  # entered the console (cookie `igris_welcomed=1`). After that, it goes
  # straight to /home.
  root to: 'welcome#root'

  get '/welcome', to: 'welcome#index', as: :welcome
  post '/welcome/enter', to: 'welcome#enter', as: :enter_console

  get '/home', to: 'home#index', as: :home

  resources :actions, only: %i[index new create show] do
    member do
      post :run
    end
  end

  resources :runs, only: %i[index show]
  resources :runtimes, only: :index
  resources :settings, only: :index

  # Health
  get '/up', to: ->(_env) { [200, { 'Content-Type' => 'text/plain' }, ['ok']] }
end

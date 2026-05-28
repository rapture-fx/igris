Rails.application.routes.draw do
  root to: redirect('/home')

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

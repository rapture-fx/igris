# frozen_string_literal: true

require 'spec_helper'
require 'webmock/rspec'
require 'schlep_engine'

RSpec.describe Schlep::Engine::Client do
  let(:api_key) { 'test-api-key' }
  let(:base_url) { 'https://api.test.com/v1' }
  let(:client) { described_class.new(api_key, base_url: base_url) }

  before do
    WebMock.disable_net_connect!(allow_localhost: true)
  end

  describe '#initialize' do
    it 'creates a client with valid API key' do
      expect(client.base_url).to eq(base_url)
    end

    it 'raises ConfigurationError with nil API key' do
      expect { described_class.new(nil) }.to raise_error(Schlep::Engine::ConfigurationError)
    end

    it 'raises ConfigurationError with empty API key' do
      expect { described_class.new('') }.to raise_error(Schlep::Engine::ConfigurationError)
    end
  end

  describe '.from_env' do
    it 'creates client from environment variable' do
      ENV['SCHLEP_API_KEY'] = 'env-api-key'
      client = described_class.from_env(base_url: base_url)
      expect(client).to be_a(described_class)
      ENV.delete('SCHLEP_API_KEY')
    end

    it 'raises ConfigurationError when env var not set' do
      ENV.delete('SCHLEP_API_KEY')
      expect { described_class.from_env }.to raise_error(Schlep::Engine::ConfigurationError)
    end
  end

  describe '#upload' do
    it 'successfully uploads data' do
      response_body = {
        job_id: 'upload_123',
        status: 'processing',
        message: 'Upload successful'
      }.to_json

      stub_request(:post, "#{base_url}/upload")
        .with(
          body: { data: 'test data' }.to_json,
          headers: {
            'Authorization' => 'Bearer test-api-key',
            'Content-Type' => 'application/json'
          }
        )
        .to_return(status: 200, body: response_body, headers: { 'Content-Type' => 'application/json' })

      result = client.upload('test data')

      expect(result).to be_a(Schlep::Engine::UploadResponse)
      expect(result.job_id).to eq('upload_123')
      expect(result.status).to eq('processing')
      expect(result.message).to eq('Upload successful')
    end
  end

  describe '#train' do
    it 'successfully trains with hash config' do
      response_body = {
        job_id: 'train_456',
        model_id: 'model_789',
        status: 'training',
        message: 'Training started'
      }.to_json

      config = {
        model_type: 'classification',
        dataset_id: 'upload_123'
      }

      stub_request(:post, "#{base_url}/train")
        .with(
          body: config.to_json,
          headers: {
            'Authorization' => 'Bearer test-api-key',
            'Content-Type' => 'application/json'
          }
        )
        .to_return(status: 200, body: response_body, headers: { 'Content-Type' => 'application/json' })

      result = client.train(config)

      expect(result).to be_a(Schlep::Engine::TrainResponse)
      expect(result.job_id).to eq('train_456')
      expect(result.model_id).to eq('model_789')
      expect(result.status).to eq('training')
    end

    it 'successfully trains with JSON string config' do
      response_body = {
        job_id: 'train_456',
        model_id: 'model_789',
        status: 'training'
      }.to_json

      config_json = '{"model_type":"classification","dataset_id":"upload_123"}'

      stub_request(:post, "#{base_url}/train")
        .with(
          body: config_json,
          headers: {
            'Authorization' => 'Bearer test-api-key',
            'Content-Type' => 'application/json'
          }
        )
        .to_return(status: 200, body: response_body, headers: { 'Content-Type' => 'application/json' })

      result = client.train(config_json)

      expect(result).to be_a(Schlep::Engine::TrainResponse)
      expect(result.job_id).to eq('train_456')
      expect(result.model_id).to eq('model_789')
    end
  end

  describe '#deploy' do
    it 'successfully deploys model' do
      response_body = {
        deployment_id: 'deploy_101',
        endpoint_url: 'https://api.schlep-engine.com/models/model_789/predict',
        status: 'deployed',
        message: 'Model deployed successfully'
      }.to_json

      stub_request(:post, "#{base_url}/deploy")
        .with(
          body: { model_id: 'model_789' }.to_json,
          headers: {
            'Authorization' => 'Bearer test-api-key',
            'Content-Type' => 'application/json'
          }
        )
        .to_return(status: 200, body: response_body, headers: { 'Content-Type' => 'application/json' })

      result = client.deploy('model_789')

      expect(result).to be_a(Schlep::Engine::DeployResponse)
      expect(result.deployment_id).to eq('deploy_101')
      expect(result.endpoint_url).to eq('https://api.schlep-engine.com/models/model_789/predict')
      expect(result.status).to eq('deployed')
    end
  end

  describe '#status' do
    it 'successfully checks job status' do
      response_body = {
        job_id: 'job_123',
        status: 'completed',
        progress: 100.0,
        result: { output: 'Job completed successfully' },
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z'
      }.to_json

      stub_request(:get, "#{base_url}/status/job_123")
        .with(
          headers: {
            'Authorization' => 'Bearer test-api-key'
          }
        )
        .to_return(status: 200, body: response_body, headers: { 'Content-Type' => 'application/json' })

      result = client.status('job_123')

      expect(result).to be_a(Schlep::Engine::StatusResponse)
      expect(result.job_id).to eq('job_123')
      expect(result.status).to eq('completed')
      expect(result.progress).to eq(100.0)
      expect(result.result).to be_a(Hash)
    end
  end

  describe '#stream' do
    it 'sets up streaming configuration' do
      config = {
        event_types: ['training', 'deployment'],
        filters: { user_id: '123' }
      }

      expect { |b| client.stream(config, &b) }.to yield_with_args(Hash)
    end
  end

  describe 'error handling' do
    it 'raises ApiError on 401 Unauthorized' do
      stub_request(:post, "#{base_url}/upload")
        .to_return(status: 401, body: { message: 'Invalid API key' }.to_json)

      expect { client.upload('test data') }.to raise_error(Schlep::Engine::ApiError) do |error|
        expect(error.status_code).to eq(401)
        expect(error.message).to include('Invalid API key')
      end
    end

    it 'raises ApiError on 400 Bad Request' do
      stub_request(:post, "#{base_url}/train")
        .to_return(status: 400, body: { message: 'Invalid training configuration' }.to_json)

      expect { client.train({}) }.to raise_error(Schlep::Engine::ApiError) do |error|
        expect(error.status_code).to eq(400)
        expect(error.message).to include('Invalid training configuration')
      end
    end

    it 'handles network errors' do
      stub_request(:post, "#{base_url}/upload").to_raise(Faraday::ConnectionFailed)

      expect { client.upload('test data') }.to raise_error(Schlep::Engine::NetworkError)
    end
  end
end
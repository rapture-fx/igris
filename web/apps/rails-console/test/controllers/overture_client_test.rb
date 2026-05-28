require 'test_helper'

class OvertureClientTest < ActiveSupport::TestCase
  test 'not configured when env var is empty' do
    client = Igris::OvertureClient.new(base_url: nil)
    refute client.configured?
    assert_nil client.list_actions.first
  end

  test 'list_actions returns empty array when unreachable' do
    client = Igris::OvertureClient.new(base_url: 'http://127.0.0.1:1', api_key: 'k')
    assert_equal [], client.list_actions
  end

  test 'run_action raises Unavailable when not configured' do
    client = Igris::OvertureClient.new(base_url: nil)
    assert_raises(Igris::OvertureClient::Unavailable) do
      client.run_action('send_email', {})
    end
  end
end

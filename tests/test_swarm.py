from swarm.agents import AGENT_CONFIG

def test_config_complete():
    assert all(k in AGENT_CONFIG for k in ["chief","research","programmer","qa"])

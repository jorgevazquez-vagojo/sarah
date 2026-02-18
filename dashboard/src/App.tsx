import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('agent_token'));
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('agent_token', token);
    } else {
      localStorage.removeItem('agent_token');
      setAgent(null);
    }
  }, [token]);

  const handleLogin = (tokenVal: string, agentData: any) => {
    setToken(tokenVal);
    setAgent(agentData);
  };

  const handleLogout = () => {
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard token={token} agent={agent} onLogout={handleLogout} />;
}

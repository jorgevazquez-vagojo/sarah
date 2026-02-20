import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { Wallboard } from './pages/Wallboard';

export function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('agent_token'));
  const [agent, setAgent] = useState<any>(null);

  // Check if the current path is the wallboard route
  const isWallboard = window.location.pathname === '/dashboard/wallboard'
    || window.location.pathname === '/dashboard/wallboard/';

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

  // Wallboard route: requires token but shows standalone wallboard
  if (isWallboard) {
    if (!token) {
      return <Login onLogin={handleLogin} />;
    }
    return <Wallboard />;
  }

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return <Dashboard token={token} agent={agent} onLogout={handleLogout} />;
}

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock } from 'lucide-react';
import { loginUser } from '../services/api';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await loginUser(formData);
      localStorage.setItem('token', response.token);
      
      const userObj = response.user || { name: formData.email };
      if (response.vaultAccess !== undefined) {
        userObj.vaultAccess = response.vaultAccess;
      } else if (response.user && response.user.vaultAccess !== undefined) {
        userObj.vaultAccess = response.user.vaultAccess;
      }
      
      localStorage.setItem('user', JSON.stringify(userObj));
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Background Mesh */}
      <div className="mesh-bg"></div>

      {/* Left side: Branding & Hero */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-start px-20 relative p-12 overflow-hidden">
        {/* Animated gradient background for left side */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-500 to-accent-600 animate-gradient-x opacity-90"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
        
        <div className="relative z-10 text-white w-full max-w-xl animate-fade-in">
          <div className="inline-flex items-center justify-center p-4 bg-white/20 backdrop-blur-md rounded-3xl mb-12 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            <Shield className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold mb-6 leading-tight tracking-tight font-sans">
            Secure Medical<br/>Records Platform
          </h1>
          <p className="text-xl opacity-90 leading-relaxed font-light mb-12">
            MediVault helps you safely store, manage, and access your medical history anytime with uncompromising security.
          </p>
          
          <div className="flex space-x-6">
            <div className="flex flex-col items-center bg-white/10 p-5 rounded-2xl backdrop-blur-sm">
              <span className="text-3xl font-bold mb-1">100%</span>
              <span className="text-sm uppercase tracking-wider opacity-80">Encrypted</span>
            </div>
            <div className="flex flex-col items-center bg-white/10 p-5 rounded-2xl backdrop-blur-sm">
              <span className="text-3xl font-bold mb-1">24/7</span>
              <span className="text-sm uppercase tracking-wider opacity-80">Access</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10 animate-fade-in">
        <div className="glass-panel p-10 sm:p-12 max-w-lg w-full">
          
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-brand-400 to-brand-600 p-2.5 rounded-xl shadow-glow">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-2xl tracking-tight text-slate-800">
                Medi<span className="text-gradient">Vault</span>
              </span>
            </div>
          </div>

          <div className="text-center sm:text-left mb-10">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Welcome Back</h2>
            <p className="text-slate-500 font-medium">Sign in to access your digital medical history.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50/80 border border-red-100 text-red-600 p-4 rounded-2xl text-sm font-medium animate-slide-up">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type="email"
                    required
                    className="input-field pl-12"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type="password"
                    required
                    className="input-field pl-12"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-600">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-500 transition-colors">Forgot password?</Link>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary w-full mt-4"
            >
              <span className="relative z-10 flex items-center justify-center gap-2 text-lg">
                {loading ? 'Authenticating...' : 'Sign In to Vault'}
              </span>
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-600 font-medium">
              New to MediVault?{' '}
              <Link to="/register" className="text-brand-600 font-bold hover:text-accent-600 transition-colors">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

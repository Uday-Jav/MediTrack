import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock, User } from 'lucide-react';
import { registerUser } from '../services/api';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await registerUser(formData);
      if (response.token) {
        localStorage.setItem('token', response.token);
      }
      if (response.user) {
        const userObj = response.user;
        if (response.vaultAccess !== undefined) {
           userObj.vaultAccess = response.vaultAccess;
        }
        localStorage.setItem('user', JSON.stringify(userObj));
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="mesh-bg"></div>

      {/* Left side: Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-start px-20 relative p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-600 via-brand-500 to-brand-600 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
        
        <div className="relative z-10 text-white w-full max-w-xl animate-fade-in">
          <div className="inline-flex items-center justify-center p-4 bg-white/20 backdrop-blur-md rounded-3xl mb-12 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            <Shield className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold mb-6 leading-tight tracking-tight font-sans">
            Join the Secure<br/>Health Network
          </h1>
          <p className="text-xl opacity-90 leading-relaxed font-light mb-12">
            Create your account to start managing your medical records with military-grade encryption.
          </p>
          
          <div className="flex space-x-6">
            <div className="flex flex-col items-center bg-white/10 p-5 rounded-2xl backdrop-blur-sm">
              <span className="text-3xl font-bold mb-1">256-bit</span>
              <span className="text-sm uppercase tracking-wider opacity-80">Encryption</span>
            </div>
            <div className="flex flex-col items-center bg-white/10 p-5 rounded-2xl backdrop-blur-sm">
              <span className="text-3xl font-bold mb-1">HIPAA</span>
              <span className="text-sm uppercase tracking-wider opacity-80">Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Register Form */}
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
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Create Account</h2>
            <p className="text-slate-500 font-medium">Sign up to get started with your secure vault.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50/80 border border-red-100 text-red-600 p-4 rounded-2xl text-sm font-medium animate-slide-up">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                  <input
                    type="text"
                    required
                    className="input-field pl-12"
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

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
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="btn-primary w-full mt-4"
            >
              <span className="relative z-10 flex items-center justify-center gap-2 text-lg">
                {loading ? 'Creating Account...' : 'Create Account'}
              </span>
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-600 font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-brand-600 font-bold hover:text-accent-600 transition-colors">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

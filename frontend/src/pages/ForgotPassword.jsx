import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mail, Lock, ArrowLeft, CheckCircle, KeyRound } from 'lucide-react';
import { forgotPassword, resetPassword } from '../services/api';

const ForgotPassword = () => {
  // Steps: 'email' -> 'reset' -> 'success'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await forgotPassword(email);
      if (response.resetToken) {
        setResetToken(response.resetToken);
      }
      setStep('reset');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to process request. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(resetToken, newPassword);
      setStep('success');
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="mesh-bg"></div>

      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-start px-20 relative p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-accent-500 to-brand-600 opacity-90"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>

        <div className="relative z-10 text-white w-full max-w-xl animate-fade-in">
          <div className="inline-flex items-center justify-center p-4 bg-white/20 backdrop-blur-md rounded-3xl mb-12 shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            <KeyRound className="w-16 h-16 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold mb-6 leading-tight tracking-tight font-sans">
            Account<br />Recovery
          </h1>
          <p className="text-xl opacity-90 leading-relaxed font-light mb-12">
            Don&apos;t worry - we&apos;ll help you regain access to your secure medical vault in just a few steps.
          </p>
        </div>
      </div>

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

          {step === 'email' && (
            <>
              <div className="text-center sm:text-left mb-10">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Forgot Password</h2>
                <p className="text-slate-500 font-medium">Enter the email linked to your account to receive a reset token.</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                {error && (
                  <div className="bg-red-50/80 border border-red-100 text-red-600 p-4 rounded-2xl text-sm font-medium animate-slide-up">
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                    <input
                      type="email"
                      required
                      className="input-field pl-12"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  <span className="relative z-10 flex items-center justify-center gap-2 text-lg">
                    {loading ? 'Sending...' : 'Send Reset Token'}
                  </span>
                </button>
              </form>
            </>
          )}

          {step === 'reset' && (
            <>
              <div className="text-center sm:text-left mb-10">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Reset Password</h2>
                <p className="text-slate-500 font-medium">
                  {resetToken
                    ? 'A reset token was returned. Enter your new password below.'
                    : 'Enter the reset token sent to your email and your new password.'}
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-6">
                {error && (
                  <div className="bg-red-50/80 border border-red-100 text-red-600 p-4 rounded-2xl text-sm font-medium animate-slide-up">
                    {error}
                  </div>
                )}

                {!resetToken && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Reset Token</label>
                    <div className="relative group">
                      <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                      <input
                        type="text"
                        required
                        className="input-field pl-12"
                        placeholder="Paste your reset token"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {resetToken && (
                  <div className="bg-brand-50/60 border border-brand-200 p-4 rounded-2xl">
                    <p className="text-sm font-semibold text-brand-700 mb-1">Token received automatically</p>
                    <p className="text-xs text-brand-600 font-mono break-all">{resetToken.substring(0, 40)}...</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                    <input
                      type="password"
                      required
                      className="input-field pl-12"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">Confirm Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-brand-500 transition-colors" />
                    <input
                      type="password"
                      required
                      className="input-field pl-12"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  <span className="relative z-10 flex items-center justify-center gap-2 text-lg">
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </span>
                </button>
              </form>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-8 animate-slide-up">
              <div className="inline-flex p-5 bg-green-50 rounded-full mb-8">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Password Reset!</h2>
              <p className="text-slate-500 font-medium mb-8 max-w-sm mx-auto">
                Your password has been successfully updated. You can now sign in with your new password.
              </p>
              <Link to="/login" className="btn-primary inline-flex px-8 py-3">
                <span className="relative z-10 flex items-center justify-center gap-2 text-lg">
                  Back to Sign In
                </span>
              </Link>
            </div>
          )}

          {step !== 'success' && (
            <div className="mt-8 text-center">
              <Link to="/login" className="text-slate-600 font-medium inline-flex items-center gap-2 hover:text-brand-600 transition-colors">
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

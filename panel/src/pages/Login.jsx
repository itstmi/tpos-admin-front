import { useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Shield, User, Zap } from 'lucide-react';
import { errorText } from '../api';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(errorText(err));
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

      <div className="text-center mb-6 relative z-10">
        <img src="/logo.png" alt="TPOS Logo" className="w-40 h-40 mx-auto mb-2 object-contain" />
        <p className="text-slate-400 flex items-center justify-center gap-2 font-medium">
          <Shield size={16} className="text-emerald-500" />
          Super Admin Panel
        </p>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl blur-xl opacity-20"></div>
        <div className="relative bg-slate-900/80 backdrop-blur-2xl rounded-3xl shadow-2xl p-8 border border-slate-800/50">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white">Welcome Back!</h2>
            <p className="text-slate-500 mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Username</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <User size={20} className="text-slate-500 group-focus-within:text-emerald-500" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  maxLength={64}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border-2 border-slate-700/50 rounded-2xl focus:border-emerald-500 focus:bg-slate-800/80 outline-none transition-all text-white placeholder-slate-600 font-medium"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-400 mb-2">Password</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Lock size={20} className="text-slate-500 group-focus-within:text-emerald-500" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  maxLength={128}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-slate-800/50 border-2 border-slate-700/50 rounded-2xl focus:border-emerald-500 focus:bg-slate-800/80 outline-none transition-all text-white placeholder-slate-600 font-medium"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                <AlertCircle size={20} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-4 rounded-2xl font-bold text-lg hover:from-emerald-400 hover:to-teal-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/25"
            >
              {loading ? (
                <>
                  <Loader2 size={24} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>LOGIN</span>
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <Zap size={14} />
                  </div>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="mt-10 text-center relative z-10">
        <p className="text-slate-700 text-xs flex items-center justify-center gap-2">
          <span>Developed by</span>
          <span className="font-bold text-slate-500">FAAH TECH (SMC-PRIVATE) LIMITED</span>
        </p>
      </div>
    </div>
  );
};

export default Login;

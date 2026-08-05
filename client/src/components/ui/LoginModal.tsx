import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mic, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLogin, useSignup } from '../../api/hooks/useAuth';
import { API_BASE } from '../../api/client';
import { Button } from './Button';
import { TextInput } from './Input';
import Card from './Card';
import IconCircle from './IconCircle';

type Mode = 'login' | 'signup';

const LoginModal = () => {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const pending = useMemo(() => loginMutation.isPending || signupMutation.isPending, [loginMutation.isPending, signupMutation.isPending]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      navigate(-1);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    loginMutation.mutate(formData, {
      onSuccess: () => navigate('/dashboard', { replace: true }),
    });
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    signupMutation.mutate(
      { email, password },
      {
        onSuccess: async () => {
          const formData = new FormData();
          formData.append('username', email);
          formData.append('password', password);
          loginMutation.mutate(formData, {
            onSuccess: () => navigate('/dashboard', { replace: true }),
          });
        },
      }
    );
  };

  const googleSignup = () => {
    const baseUrl = API_BASE.replace(/\/$/, '');
    window.location.href = `${baseUrl}/auth/google/start`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="max-w-md w-full p-4 sm:p-8"
        >
          <Card variant="panel" className="p-6 sm:p-8">
            <div className="flex flex-col items-center mb-6">
              <IconCircle icon={Mic} className="mb-4" />
              <h2 className="text-2xl font-semibold tracking-tight text-theme-primary">
                {mode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="text-sm text-theme-secondary mt-1">
                {mode === 'signup'
                  ? 'Sign up with email or continue with Google.'
                  : 'Log in with the account you already created.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-6 rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === 'signup' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
                }`}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
                }`}
              >
                Log in
              </button>
            </div>

            {mode === 'signup' && (
              <div className="space-y-3 mb-6">
                <Button type="button" variant="secondary" className="w-full" onClick={googleSignup}>
                  <Sparkles className="w-4 h-4" />
                  <span>Continue with Google</span>
                </Button>
                <div className="relative py-1 text-center text-xs uppercase tracking-[0.3em] text-theme-secondary">
                  <span className="bg-white px-3">or sign up with email</span>
                  <div className="absolute left-0 right-0 top-1/2 -z-10 h-px bg-slate-200" />
                </div>
              </div>
            )}

            <form onSubmit={mode === 'signup' ? handleSignup : handleLogin} className="space-y-4">
              <TextInput
                id={`${mode}-email`}
                type="email"
                required
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <TextInput
                id={`${mode}-password`}
                type="password"
                required
                label="Password"
                helperText={mode === 'signup' ? 'Use at least 8 characters.' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <Button type="submit" variant="primary" disabled={pending} className="w-full mt-2">
                {pending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{mode === 'signup' ? 'Creating account...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <span>{mode === 'signup' ? 'Create account' : 'Sign in'}</span>
                )}
              </Button>

              <AnimatePresence>
                {(loginMutation.isError || signupMutation.isError) && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700"
                  >
                    {mode === 'signup'
                      ? 'Could not create account. The email may already be registered.'
                      : 'Invalid credentials. Please try again.'}
                  </motion.div>
                )}
              </AnimatePresence>
            </form>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LoginModal;

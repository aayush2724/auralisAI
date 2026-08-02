import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../../api/hooks/useAuth';
import { Button } from './Button';
import { TextInput } from './Input';
import Card from './Card';
import IconCircle from './IconCircle';

const LoginModal = () => {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      navigate(-1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('username', email); // FastAPI OAuth2 uses 'username'
    formData.append('password', password);
    
    loginMutation.mutate(formData, {
      onSuccess: () => {
        // Token is saved in useAuth, now redirect to dashboard
        navigate('/dashboard', { replace: true });
      }
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleBackdropClick}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="max-w-sm w-full p-8"
        >
          <Card variant="panel" className="p-8">
            <div className="flex flex-col items-center mb-6">
              <IconCircle icon={Mic} className="mb-4" />
              <h2 className="text-2xl font-semibold tracking-tight text-theme-primary">Welcome back</h2>
              <p className="text-sm text-theme-secondary mt-1">Sign in to your workspace</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <TextInput
                id="login-email"
                type="email"
                required
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <TextInput
                id="login-password"
                type="password"
                required
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <Button
                type="submit"
                variant="primary"
                disabled={loginMutation.isPending}
                className="w-full mt-2"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </Button>

              <AnimatePresence>
                {loginMutation.isError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700"
                  >
                    Invalid credentials. Please try again.
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

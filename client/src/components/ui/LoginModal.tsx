import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../../api/hooks/useAuth';
import { Button } from './Button';

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="max-w-sm w-full bg-white rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#dd6668] to-[#0a0a0a] flex items-center justify-center mb-4">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-display font-normal tracking-tight text-[#0a0a0a]">Welcome back</h2>
            <p className="text-sm font-sans font-light text-[#6b7280] mt-1">Sign in to your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block font-sans font-medium text-xs uppercase tracking-widest text-[#0a0a0a] mb-1">Email</label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-[#f9fafb] rounded-xl px-4 py-3 focus:border-[#dd6668] focus:ring-1 focus:ring-[#dd6668] outline-none transition-all text-[#0a0a0a] font-sans"
              />
            </div>
            
            <div>
              <label htmlFor="login-password" className="block font-sans font-medium text-xs uppercase tracking-widest text-[#0a0a0a] mb-1">Password</label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#f9fafb] rounded-xl px-4 py-3 focus:border-[#dd6668] focus:ring-1 focus:ring-[#dd6668] outline-none transition-all text-[#0a0a0a] font-sans"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center space-x-2 mt-2"
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
                  className="mt-4 text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2"
                >
                  Invalid credentials. Please try again.
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LoginModal;

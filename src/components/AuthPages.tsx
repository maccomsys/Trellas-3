import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, MailCheck, ShieldCheck } from 'lucide-react';
import { ApiError } from '../lib/api';
import {
  LocalApiError,
  localDemoLogin,
  localLogin,
  localRegister,
  localRequestPasswordReset,
  localResetPassword,
  localVerifyEmail,
} from '../lib/localWorkspaceService';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  ensureSupabaseUserProfile,
  runSupabaseOnboardingIfNeeded,
  seedClientDemoWorkspaceForCurrentUser,
  seedSupabaseDemoWorkspace,
  SupabaseApiError,
} from '../lib/supabaseService';
import { useApp } from './AppContext';
import { TrellasLogo } from './TrellasLogo';

export const AuthPages: React.FC = () => {
  const { route, navigate, loginSuccess, showToast, isRecoveryMode, setIsRecoveryMode } = useApp();

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPass, setShowPass] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWorkspace, setRegWorkspace] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [includeSample, setIncludeSample] = useState(true);

  // Forgot / Reset / Verify state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [verifyEmailAddr, setVerifyEmailAddr] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const formatAuthError = (err: unknown, fallback: string): string => {
    if (err instanceof ApiError || err instanceof SupabaseApiError || err instanceof LocalApiError) {
      return err.message;
    }
    return fallback;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        const res = await localLogin(loginEmail, loginPassword);
        await loginSuccess(res);
        showToast(`Welcome back, ${res.user.full_name}`, 'success');
        return;
      }
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (authErr || !data.session || !data.user) {
        throw new ApiError(authErr?.message || 'Unable to sign in.', 401);
      }
      const profile = await ensureSupabaseUserProfile(data.user);
      await runSupabaseOnboardingIfNeeded();
      await loginSuccess({ token: data.session.access_token, user: profile.user, preferences: profile.preferences });
      showToast(`Welcome back, ${profile.user.full_name}`, 'success');
    } catch (err) {
      setError(formatAuthError(err, 'Unable to sign in.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        const res = await localDemoLogin();
        await loginSuccess(res);
        showToast('Signed into Northstar Studio demo workspace', 'success');
        return;
      }
      const sb = supabase;
      const { usedAdmin } = await seedSupabaseDemoWorkspace();
      let { data, error: authErr } = await sb.auth.signInWithPassword({
        email: 'maya@trellas.app',
        password: 'TrellasDemo2026!',
      });

      if ((authErr || !data.session || !data.user) && !usedAdmin) {
        const signUpRes = await sb.auth.signUp({
          email: 'maya@trellas.app',
          password: 'TrellasDemo2026!',
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: 'Maya Chen',
              avatar_url: '/src/assets/images/avatar_maya_chen_1795389987021.jpg',
              workspace_name: 'Northstar Studio',
              include_sample_data: true,
            },
          },
        });
        if (signUpRes.data?.session && signUpRes.data?.user) {
          data = { session: signUpRes.data.session, user: signUpRes.data.user };
          authErr = null;
        } else if (signUpRes.data?.user && !signUpRes.data?.session) {
          throw new ApiError(
            'Demo account requires email confirmation in your Supabase Auth settings, or create your own account to get started.',
            400,
          );
        } else if (signUpRes.error) {
          throw new ApiError(
            authErr?.message || signUpRes.error.message || 'Demo login is unavailable without pre-seeded demo credentials.',
            401,
          );
        }
      }

      if (authErr || !data.session || !data.user) {
        throw new ApiError(authErr?.message || 'Demo login failed.', 401);
      }

      if (!usedAdmin) {
        await seedClientDemoWorkspaceForCurrentUser(data.user);
      }
      const profile = await ensureSupabaseUserProfile(data.user);
      await loginSuccess({ token: data.session.access_token, user: profile.user, preferences: profile.preferences });
      showToast('Signed into Northstar Studio demo workspace', 'success');
    } catch (err) {
      setError(formatAuthError(err, 'Demo login failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    if (!acceptedTerms) {
      setError('Please accept the Terms and Conditions to continue.');
      return;
    }
    if (regPassword !== regConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        const res = await localRegister({
          full_name: regName,
          email: regEmail,
          password: regPassword,
          workspace_name: regWorkspace,
          include_sample_data: includeSample,
        });
        await loginSuccess(res);
        showToast('Account & workspace created!', 'success');
        return;
      }
      const sb = supabase;
      const { data, error: signErr } = await sb.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: regName.trim(),
            workspace_name: regWorkspace.trim(),
            include_sample_data: includeSample,
          },
        },
      });
      if (signErr) {
        throw new ApiError(signErr.message, 400);
      }
      if (data.session && data.user) {
        await runSupabaseOnboardingIfNeeded({
          full_name: regName.trim(),
          workspace_name: regWorkspace.trim(),
          include_sample_data: includeSample,
          force_create: true,
        });
        const profile = await ensureSupabaseUserProfile(data.user);
        await loginSuccess({ token: data.session.access_token, user: profile.user, preferences: profile.preferences });
        showToast('Account & workspace created!', 'success');
      } else {
        setVerifyEmailAddr(regEmail.trim());
        setInfoMsg('Account created! Please check your email inbox for a verification link or 6-digit code to activate your session.');
        showToast('Check your email to confirm your account', 'info');
      }
    } catch (err) {
      setError(formatAuthError(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        const { code } = await localRequestPasswordReset(forgotEmail);
        setResetCode(code);
        setInfoMsg(`Password reset code generated: ${code}. Click "Have a reset code?" below to set your new password.`);
        return;
      }
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: window.location.origin,
      });
      if (resetErr) throw new ApiError(resetErr.message, 400);
      setInfoMsg('Password reset instructions have been sent to your email. Click the link or enter your 6-digit recovery code.');
    } catch (err) {
      setError(formatAuthError(err, 'Request failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        await localResetPassword(forgotEmail, resetCode, newPassword);
        setIsRecoveryMode(false);
        showToast('Password updated! Please sign in with your new password.', 'success');
        navigate('login');
        return;
      }
      const sb = supabase;
      if (!isRecoveryMode) {
        const { error: otpErr } = await sb.auth.verifyOtp({
          email: forgotEmail.trim(),
          token: resetCode.trim(),
          type: 'recovery',
        });
        if (otpErr) throw new ApiError(otpErr.message, 400);
      }
      const { error: updErr } = await sb.auth.updateUser({ password: newPassword });
      if (updErr) throw new ApiError(updErr.message, 400);
      setIsRecoveryMode(false);
      showToast('Password updated! Please sign in with your new password.', 'success');
      navigate('login');
    } catch (err) {
      setError(formatAuthError(err, 'Password reset failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        if (!verifyEmailAddr.trim()) {
          throw new ApiError('Please enter your account email address.', 400);
        }
        await localVerifyEmail(verifyEmailAddr);
        setInfoMsg('Email verified successfully! You can now sign in.');
        showToast('Email address verified', 'success');
        return;
      }
      const sb = supabase;
      const cleanEmail = verifyEmailAddr.trim();
      const cleanToken = verifyToken.trim();
      if (!cleanEmail) {
        throw new ApiError('Please enter your account email address.', 400);
      }
      if (cleanToken) {
        const { error: otpErr } = await sb.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'signup',
        });
        if (otpErr) throw new ApiError(otpErr.message, 400);
        setInfoMsg('Email verified successfully! You can now sign in.');
        showToast('Email address verified', 'success');
      } else {
        const { error: resendErr } = await sb.auth.resend({
          type: 'signup',
          email: cleanEmail,
          options: { emailRedirectTo: window.location.origin },
        });
        if (resendErr) throw new ApiError(resendErr.message, 400);
        setInfoMsg('Verification email sent! Check your inbox for the confirmation link or 6-digit code.');
        showToast('Verification email sent', 'success');
      }
    } catch (err) {
      setError(formatAuthError(err, 'Verification failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen trellas-grid-bg bg-[#FAF9F6] dark:bg-[#111312] text-[#1C1F1D] dark:text-[#F1F2EE] flex flex-col justify-between p-6">
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('landing')}
          className="inline-flex items-center gap-2 text-sm text-[#545C57] dark:text-[#A3ABA6] hover:text-[#1C1F1D] dark:hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to home</span>
        </button>
        <TrellasLogo size="sm" />
      </div>

      <div className="max-w-md w-full mx-auto my-10 bg-white dark:bg-[#181B1A] rounded-2xl border border-[#E5E2D9] dark:border-[#2A2F2C] p-7 sm:p-8 shadow-sm">
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-[#FEF2F2] dark:bg-[#2C1616] border border-[#FECACA] dark:border-[#5C2323] text-xs font-medium text-[#B91C1C] dark:text-[#FCA5A5]">
            {error}
          </div>
        )}
        {infoMsg && (
          <div className="mb-5 p-3 rounded-lg bg-[#ECFDF5] dark:bg-[#122920] border border-[#A7F3D0] dark:border-[#1E4A38] text-xs font-medium text-[#166534] dark:text-[#6EE7B7]">
            {infoMsg}
          </div>
        )}

        {route === 'login' && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Sign in to Trellas</h1>
              <p className="text-sm text-[#545C57] dark:text-[#A3ABA6] mt-1">
                Enter your account credentials to open your workspace.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" htmlFor="login-email">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="maya@trellas.app"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] focus:outline-none focus:border-[#1B3B2B] dark:focus:border-[#6EE7B7]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold" htmlFor="login-password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setInfoMsg(null);
                      navigate('forgot-password');
                    }}
                    className="text-xs font-medium text-[#1B3B2B] dark:text-[#6EE7B7] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] focus:outline-none focus:border-[#1B3B2B] dark:focus:border-[#6EE7B7]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#646D67] hover:text-[#1C1F1D] dark:hover:text-white cursor-pointer"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#545C57] dark:text-[#A3ABA6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#DEDAD0] text-[#1B3B2B]"
                />
                <span>Remember me on this device for 30 days</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-[#FAF9F6] text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="pt-4 border-t border-[#ECE9E0] dark:border-[#242926] space-y-3">
              <button
                type="button"
                disabled={loading}
                onClick={handleDemoLogin}
                className="w-full py-2.5 px-4 rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] hover:border-[#1B3B2B] dark:hover:border-[#6EE7B7] text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1B3B2B] dark:text-[#6EE7B7]" />
                  <span>Explore Demo Workspace (Maya Chen)</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <div className="text-[11px] text-[#6E7670] dark:text-[#8E9691] text-center font-mono-num">
                Demo: maya@trellas.app / TrellasDemo2026!
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#545C57] dark:text-[#A3ABA6] pt-2">
              <button
                type="button"
                onClick={() => navigate('verify-email')}
                className="hover:underline cursor-pointer"
              >
                Verify email
              </button>
              <span>
                New to Trellas?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    navigate('register');
                  }}
                  className="font-semibold text-[#1B3B2B] dark:text-[#6EE7B7] hover:underline cursor-pointer"
                >
                  Create account
                </button>
              </span>
            </div>
          </div>
        )}

        {route === 'register' && (
          <div className="space-y-5">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Create your workspace</h1>
              <p className="text-sm text-[#545C57] dark:text-[#A3ABA6] mt-1">
                Start organizing projects and tasks in under a minute.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1" htmlFor="reg-name">
                  Full name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" htmlFor="reg-email">
                  Work email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" htmlFor="reg-workspace">
                  Workspace name
                </label>
                <input
                  id="reg-workspace"
                  type="text"
                  value={regWorkspace}
                  onChange={(e) => setRegWorkspace(e.target.value)}
                  placeholder="Acme Design Studio"
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] focus:outline-none focus:border-[#1B3B2B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" htmlFor="reg-pass">
                    Password (8+ chars)
                  </label>
                  <input
                    id="reg-pass"
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" htmlFor="reg-confirm">
                    Confirm password
                  </label>
                  <input
                    id="reg-confirm"
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E] focus:outline-none focus:border-[#1B3B2B]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#545C57] dark:text-[#A3ABA6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSample}
                  onChange={(e) => setIncludeSample(e.target.checked)}
                />
                <span>Include a sample starter project ready to edit</span>
              </label>

              <label className="flex items-start gap-2 text-xs text-[#545C57] dark:text-[#A3ABA6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I accept the Trellas Terms of Service and Privacy Policy.</span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-[#FAF9F6] text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                <span>{loading ? 'Creating workspace...' : 'Create workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="text-xs text-center text-[#545C57] dark:text-[#A3ABA6] pt-2">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  navigate('login');
                }}
                className="font-semibold text-[#1B3B2B] dark:text-[#6EE7B7] hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </div>
          </div>
        )}

        {route === 'forgot-password' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-[#1B3B2B] dark:text-[#6EE7B7]">
              <KeyRound className="w-5 h-5" />
              <h1 className="font-display text-2xl tracking-tight text-[#1C1F1D] dark:text-[#F1F2EE]">Reset password</h1>
            </div>
            <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
              Enter your account email to generate a password reset code.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" htmlFor="forgot-email">
                  Email address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-[#FAF9F6] text-sm font-medium cursor-pointer"
              >
                {loading ? 'Generating...' : 'Send reset instructions'}
              </button>
            </form>

            <div className="flex justify-between text-xs pt-2">
              <button type="button" onClick={() => navigate('login')} className="text-[#545C57] hover:underline cursor-pointer">
                Back to sign in
              </button>
              <button type="button" onClick={() => navigate('reset-password')} className="text-[#1B3B2B] dark:text-[#6EE7B7] font-medium hover:underline cursor-pointer">
                Have a reset code?
              </button>
            </div>
          </div>
        )}

        {route === 'reset-password' && (
          <div className="space-y-5">
            <h1 className="font-display text-2xl tracking-tight">Choose new password</h1>
            <form onSubmit={handleResetPassword} className="space-y-3.5">
              {!isRecoveryMode && (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Account email</label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Reset code</label>
                    <input
                      type="text"
                      required
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm font-mono-num rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1">New password (8+ chars)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Confirm new password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-[#FAF9F6] text-sm font-medium cursor-pointer"
              >
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </form>
            <button type="button" onClick={() => navigate('login')} className="text-xs text-[#545C57] hover:underline cursor-pointer">
              Back to sign in
            </button>
          </div>
        )}

        {route === 'verify-email' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-[#1B3B2B] dark:text-[#6EE7B7]">
              <MailCheck className="w-5 h-5" />
              <h1 className="font-display text-2xl tracking-tight text-[#1C1F1D] dark:text-[#F1F2EE]">Verify email address</h1>
            </div>
            <p className="text-sm text-[#545C57] dark:text-[#A3ABA6]">
              Confirm your account email address to mark your profile as verified.
            </p>
            <form onSubmit={handleVerifyEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Account email</label>
                <input
                  type="email"
                  value={verifyEmailAddr}
                  onChange={(e) => setVerifyEmailAddr(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Or verification token</label>
                <input
                  type="text"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  placeholder="Optional verification token"
                  className="w-full px-3.5 py-2.5 text-sm font-mono-num rounded-lg bg-[#FAF9F6] dark:bg-[#121514] border border-[#DEDAD0] dark:border-[#2C312E]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1B3B2B] hover:bg-[#142D20] text-[#FAF9F6] text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Verifying...' : 'Verify email'}</span>
              </button>
            </form>
            <button type="button" onClick={() => navigate('login')} className="text-xs text-[#545C57] hover:underline cursor-pointer">
              Back to sign in
            </button>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-[#646D67] dark:text-[#8E9691]">
        Trellas Workspace · Secure session authentication
      </div>
    </div>
  );
};

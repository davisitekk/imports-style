import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context.jsx';
import { sb } from '../lib/supabase.js';
import { errMsg, isValidEmail } from '../lib/utils.js';
import { Logo } from '../components/Public.jsx';

export default function AuthPage() {
  const { session } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const dest = loc.state?.from || '/dashboard';

  useEffect(() => { if (session) nav(dest, { replace: true }); }, [session]);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setInfo('');
    if (!isValidEmail(email)) return setError('Informe um e-mail valido.');
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.');
    setLoading(true);
    try {
      const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      nav(dest, { replace: true });
    } catch (err) { setError(errMsg(err)); } finally { setLoading(false); }
  };

  const reset = async () => {
    setError(''); setInfo('');
    if (!isValidEmail(email)) return setError('Digite seu e-mail para redefinir a senha.');
    const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth` });
    if (error) setError(errMsg(error)); else setInfo('Enviamos um link de redefinicao para seu e-mail.');
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <Logo />
        <h2 style={{ marginTop: 22 }}>Acesso da equipe</h2>
        <p className="small muted">Entre com seu e-mail e senha.</p>
        <label htmlFor="em">E-mail</label>
        <input id="em" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="pw" style={{ marginTop: 14 }}>Senha</label>
        <input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="alert error">{error}</div>}
        {info && <div className="alert ok">{info}</div>}
        <button className="btn btn-gold btn-block" style={{ marginTop: 18 }} disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        <button type="button" className="link-btn" onClick={reset}>Esqueci minha senha</button>
        <div style={{ marginTop: 10 }}><Link to="/" className="small muted">← Voltar a loja</Link></div>
      </form>
    </div>
  );
}

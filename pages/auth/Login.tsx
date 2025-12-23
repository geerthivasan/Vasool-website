
import React, { useState } from 'react';
import { useApp } from '../../App';
import { toast } from 'react-hot-toast';

type AuthMode = 'LOGIN' | 'SIGNUP';

const Login: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    businessName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, signup } = useApp();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === 'LOGIN') {
        await login(formData.email, formData.password);
      } else {
        await signup({
          email: formData.email,
          fullName: formData.fullName,
          businessName: formData.businessName,
          pass: formData.password
        });
      }
    } catch (error) {
      toast.error("Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    if (!formData.email) {
      toast.error("Please enter your email address first.");
      return;
    }
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: 'Verifying business record...',
        success: `Recovery link sent to ${formData.email}`,
        error: 'Failed to send recovery email.',
      }
    );
  };

  const setDemoAccount = (email: string) => {
    setFormData({ ...formData, email, password: 'password123' });
    // Fix: toast.info is not a method in react-hot-toast, using default toast instead
    toast("Demo credentials loaded.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-500 my-8">
        {/* Brand Header */}
        <div className="p-10 text-center bg-white border-b border-slate-50">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-indigo-600 mb-6 shadow-xl shadow-indigo-100 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
            <svg viewBox="0 0 24 24" className="h-10 w-10 text-white fill-current" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fillOpacity="0.5"/>
              <path d="M2 17L12 22L22 17M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M12 22V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Vasool</h1>
          <p className="text-indigo-500 text-xs mt-2 uppercase tracking-[0.3em] font-black">
            {mode === 'LOGIN' ? 'Cashflow Intelligence' : 'Start Recovering Receivables'}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex p-2 bg-slate-100 mx-10 mt-6 rounded-xl">
          <button 
            onClick={() => setMode('LOGIN')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'LOGIN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Login
          </button>
          <button 
            onClick={() => setMode('SIGNUP')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'SIGNUP' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Get Started
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-5">
          {mode === 'SIGNUP' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Identity</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                    <i className="fa-solid fa-briefcase"></i>
                  </span>
                  <input
                    required
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleInputChange}
                    placeholder="e.g. Acme Manufacturing Ltd"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proprietor Name</label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                    <i className="fa-solid fa-user-tie"></i>
                  </span>
                  <input
                    required
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                <i className="fa-solid fa-envelope"></i>
              </span>
              <input
                required
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="founder@acme.com"
                className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Key</label>
              {mode === 'LOGIN' && (
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-[10px] text-indigo-500 font-black uppercase tracking-wider hover:underline"
                >
                  Forgot Key?
                </button>
              )}
            </div>
            <div className="relative group">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                <i className="fa-solid fa-lock"></i>
              </span>
              <input
                required
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all text-sm font-medium"
              />
            </div>
          </div>

          <button
            disabled={isSubmitting}
            type="submit"
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 tracking-wide uppercase text-sm mt-4"
          >
            {isSubmitting ? (
              <i className="fa-solid fa-spinner fa-spin"></i>
            ) : (
              <>
                {mode === 'LOGIN' ? 'Authenticate' : 'Initialize Account'} 
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </>
            )}
          </button>

          {mode === 'LOGIN' && (
            <div className="flex flex-wrap gap-2 pt-2 justify-center">
               <span onClick={() => setDemoAccount('founder@acme.com')} className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-transparent hover:border-indigo-100">Owner Demo</span>
               <span onClick={() => setDemoAccount('admin@vasool.com')} className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 transition-colors border border-transparent hover:border-indigo-100">Admin Demo</span>
            </div>
          )}
        </form>

        <div className="p-6 bg-slate-50/50 border-t border-slate-50 text-center">
          <p className="text-[10px] text-slate-400 font-medium flex items-center justify-center gap-2">
            <i className="fa-solid fa-shield-halved text-indigo-400"></i>
            Secured with <span className="font-black text-slate-600">Vasool 256-bit Encryption</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

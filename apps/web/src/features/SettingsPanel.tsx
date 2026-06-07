import React, { useState } from 'react';
import { Save, GitBranch, Shield, Key } from 'lucide-react';
import { useToast } from '../components/Toast';

interface SettingsPanelProps {
  initialRepoUrl?: string;
  initialBranch?: string;
}

export default function SettingsPanel({
  initialRepoUrl = 'https://github.com/Kalrav13/TestLens.git',
  initialBranch = 'main'
}: SettingsPanelProps) {
  const { showToast } = useToast();

  const [repoUrl, setRepoUrl] = useState(initialRepoUrl);
  const [branch, setBranch] = useState(initialBranch);
  const [retentionDays, setRetentionDays] = useState('30');
  const [defaultBrowser, setDefaultBrowser] = useState('Chromium');
  const [authToken, setAuthToken] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Simulate save response
      showToast('Settings saved successfully.', 'SUCCESS');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings.', 'ERROR');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-250">Configuration Preferences</h3>
        <p className="text-xs text-slate-500 mt-0.5">Manage analysis parameters and repository credentials</p>
      </div>

      <form onSubmit={handleSave} className="glass-card rounded-xl border border-slate-800 p-6 space-y-5">
        {/* Repository settings */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-900 pb-2">
            <GitBranch className="h-4 w-4 text-indigo-400" />
            <span>Repository Context</span>
          </h4>
          
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div className="col-span-2 space-y-1.5">
              <label className="text-slate-400 font-medium">Git Repository URL</label>
              <input 
                type="text" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2.5 text-slate-300 font-medium outline-none transition-colors"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-400 font-medium">Default Branch</label>
              <input 
                type="text" 
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2.5 text-slate-300 font-medium outline-none transition-colors"
                required
              />
            </div>
          </div>
        </div>

        {/* Credentials */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-900 pb-2">
            <Key className="h-4 w-4 text-violet-400" />
            <span>Private Authentication Token</span>
          </h4>
          
          <div className="space-y-1.5 text-xs">
            <label className="text-slate-400 font-medium">Access Token / SSH Key (Encrypted on write)</label>
            <input 
              type="password" 
              placeholder="••••••••••••••••••••••••"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2.5 text-slate-300 font-medium outline-none transition-colors"
            />
          </div>
        </div>

        {/* Retention & Engine options */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-900 pb-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <span>Retention & Parameters</span>
          </h4>

          <div className="grid grid-cols-2 gap-6 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-medium">Results Retention Period</label>
              <select 
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2.5 text-slate-300 font-medium outline-none transition-colors"
              >
                <option value="15">15 Days</option>
                <option value="30">30 Days</option>
                <option value="60">60 Days</option>
                <option value="90">90 Days</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-slate-400 font-medium">Default Test Browser</label>
              <select 
                value={defaultBrowser}
                onChange={(e) => setDefaultBrowser(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2.5 text-slate-300 font-medium outline-none transition-colors"
              >
                <option value="Chromium">Chromium (Chrome/Edge)</option>
                <option value="Firefox">Firefox</option>
                <option value="Webkit">Webkit (Safari)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-900 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-xs flex items-center space-x-2 transition-colors duration-150 shadow-lg shadow-indigo-600/10"
          >
            <Save className="h-4 w-4" />
            <span>Save Configurations</span>
          </button>
        </div>
      </form>
    </div>
  );
}

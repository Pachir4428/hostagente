'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { getToken, clearToken } from '@/lib/auth';

interface Bot {
  id: string;
  name: string;
  status: string;
  phoneNumber?: string;
  containerId?: string;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  running: 'bg-green-100 text-green-800',
  stopped: 'bg-gray-100 text-gray-800',
  starting: 'bg-yellow-100 text-yellow-800',
  stopping: 'bg-orange-100 text-orange-800',
  error: 'bg-red-100 text-red-800',
  waiting_qr: 'bg-blue-100 text-blue-800',
};

export default function BotDetailPage() {
  const router = useRouter();
  const params = useParams();
  const botId = params.id as string;

  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    fetchBot();
    const interval = setInterval(fetchBot, 5000);
    return () => clearInterval(interval);
  }, [botId]);

  async function fetchBot() {
    try {
      const res = await authApi.get(`/bots/${botId}`);
      setBot(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        clearToken();
        router.replace('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  async function startBot() {
    setActionLoading(true);
    try {
      await authApi.post(`/bots/${botId}/start`);
      await fetchBot();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to start bot');
    } finally {
      setActionLoading(false);
    }
  }

  async function stopBot() {
    setActionLoading(true);
    try {
      await authApi.post(`/bots/${botId}/stop`);
      await fetchBot();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to stop bot');
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteBot() {
    if (!confirm('Delete this bot? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      await authApi.delete(`/bots/${botId}`);
      router.replace('/dashboard');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete bot');
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Bot not found</p>
      </div>
    );
  }

  const isRunning = bot.status === 'running' || bot.status === 'waiting_qr';
  const isBusy = bot.status === 'starting' || bot.status === 'stopping' || actionLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-900">
            ← Dashboard
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="font-semibold text-gray-900">{bot.name}</h1>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{bot.name}</h2>
              {bot.phoneNumber && <p className="text-gray-500 mt-1">{bot.phoneNumber}</p>}
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[bot.status] || 'bg-gray-100 text-gray-800'}`}>
              {bot.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-gray-500">Bot ID</p>
              <p className="font-mono text-xs text-gray-700">{bot.id}</p>
            </div>
            {bot.containerId && (
              <div>
                <p className="text-gray-500">Container</p>
                <p className="font-mono text-xs text-gray-700">{bot.containerId.slice(0, 12)}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500">Created</p>
              <p className="text-gray-700">{new Date(bot.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-gray-500">Updated</p>
              <p className="text-gray-700">{new Date(bot.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex gap-3">
            {!isRunning ? (
              <button
                onClick={startBot}
                disabled={isBusy}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {isBusy ? 'Please wait...' : 'Start Bot'}
              </button>
            ) : (
              <button
                onClick={stopBot}
                disabled={isBusy}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 font-medium"
              >
                {isBusy ? 'Please wait...' : 'Stop Bot'}
              </button>
            )}
            <button
              onClick={deleteBot}
              disabled={isBusy}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

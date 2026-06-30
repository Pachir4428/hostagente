'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';

interface Bot {
  id: string;
  name: string;
  status: string;
  phoneNumber?: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  running: 'bg-green-100 text-green-800',
  stopped: 'bg-gray-100 text-gray-800',
  starting: 'bg-yellow-100 text-yellow-800',
  stopping: 'bg-orange-100 text-orange-800',
  error: 'bg-red-100 text-red-800',
  waiting_qr: 'bg-blue-100 text-blue-800',
};

export default function DashboardPage() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    fetchBots();
  }, []);

  async function fetchBots() {
    try {
      const res = await authApi.get('/bots');
      setBots(res.data);
    } catch {
      clearToken();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  async function createBot() {
    if (!newBotName.trim()) return;
    setCreating(true);
    try {
      await authApi.post('/bots', { name: newBotName });
      setNewBotName('');
      setShowForm(false);
      fetchBots();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create bot');
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    clearToken();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Bot Platform</h1>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">My Bots</h2>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + New Bot
          </button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border">
            <h3 className="font-medium mb-3">Create New Bot</h3>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Bot name"
                value={newBotName}
                onChange={(e) => setNewBotName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={createBot}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
            <p className="text-gray-500 mb-4">No bots yet. Create your first bot!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <Link key={bot.id} href={`/dashboard/bots/${bot.id}`}>
                <div className="bg-white rounded-xl shadow-sm border p-5 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900">{bot.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[bot.status] || 'bg-gray-100 text-gray-800'}`}>
                      {bot.status}
                    </span>
                  </div>
                  {bot.phoneNumber && (
                    <p className="text-sm text-gray-500">{bot.phoneNumber}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Created {new Date(bot.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

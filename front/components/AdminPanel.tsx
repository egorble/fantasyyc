import React, { useState, useEffect } from 'react';
import {
    Shield,
    DollarSign,
    Trophy,
    Settings,
    RefreshCw,
    AlertTriangle,
    Play,
    Pause,
    Download,
    Plus,
    X,
    Check,
    Calendar,
    Users,
    Clock
} from 'lucide-react';
import { useWalletContext } from '../context/WalletContext';
import { useAdmin, isAdmin, ContractBalances, AdminStats, TournamentData } from '../hooks/useAdmin';
import { formatXTZ } from '../lib/contracts';
import { ethers } from 'ethers';

const AdminPanel: React.FC = () => {
    const { address, getSigner, isConnected } = useWalletContext();
    const admin = useAdmin();

    const [balances, setBalances] = useState<ContractBalances | null>(null);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [tournaments, setTournaments] = useState<TournamentData[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Form states
    const [newPackPrice, setNewPackPrice] = useState('5');
    const [newActiveTournament, setNewActiveTournament] = useState('0');
    const [showCreateTournament, setShowCreateTournament] = useState(false);
    const [tournamentForm, setTournamentForm] = useState({
        regStart: '',
        start: '',
        end: ''
    });

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Check if user is admin
    const userIsAdmin = isAdmin(address);

    // Load data
    const loadData = async () => {
        setIsRefreshing(true);
        const [b, s, t] = await Promise.all([
            admin.getContractBalances(),
            admin.getAdminStats(),
            admin.getTournaments()
        ]);
        setBalances(b);
        setStats(s);
        setTournaments(t);
        setIsRefreshing(false);
    };

    useEffect(() => {
        if (userIsAdmin) {
            loadData();
        }
    }, [userIsAdmin]);

    // Helper to format date
    const formatDate = (timestamp: number) => {
        if (!timestamp) return '-';
        return new Date(timestamp * 1000).toLocaleString('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Helper to get status text
    const getStatusInfo = (status: number) => {
        switch (status) {
            case 0: return { text: 'Created', color: 'text-blue-400 bg-blue-500/20' };
            case 1: return { text: 'Active', color: 'text-green-400 bg-green-500/20' };
            case 2: return { text: 'Finalized', color: 'text-gray-400 bg-gray-500/20' };
            case 3: return { text: 'Cancelled', color: 'text-red-400 bg-red-500/20' };
            default: return { text: 'Unknown', color: 'text-gray-500 bg-gray-500/20' };
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    // Action handlers
    const handleWithdraw = async () => {
        const signer = await getSigner();
        if (!signer) return;

        const result = await admin.withdrawPackOpener(signer);
        if (result.success) {
            showMessage('success', 'Withdrawal successful!');
            loadData();
        } else {
            showMessage('error', result.error || 'Withdrawal failed');
        }
    };

    const handleSetPackPrice = async () => {
        const signer = await getSigner();
        if (!signer) return;

        const price = parseFloat(newPackPrice);
        if (isNaN(price) || price <= 0) {
            showMessage('error', 'Invalid price');
            return;
        }

        const result = await admin.setPackPrice(signer, price);
        if (result.success) {
            showMessage('success', `Pack price set to ${price} XTZ`);
            loadData();
        } else {
            showMessage('error', result.error || 'Failed to set price');
        }
    };

    const handleSetActiveTournament = async () => {
        const signer = await getSigner();
        if (!signer) return;

        const id = parseInt(newActiveTournament);
        if (isNaN(id)) {
            showMessage('error', 'Invalid tournament ID');
            return;
        }

        const result = await admin.setActiveTournament(signer, id);
        if (result.success) {
            showMessage('success', `Active tournament set to ${id}`);
            loadData();
        } else {
            showMessage('error', result.error || 'Failed to set tournament');
        }
    };

    const handleCreateTournament = async () => {
        const signer = await getSigner();
        if (!signer) return;

        const regStart = new Date(tournamentForm.regStart).getTime() / 1000;
        const start = new Date(tournamentForm.start).getTime() / 1000;
        const end = new Date(tournamentForm.end).getTime() / 1000;

        if (!regStart || !start || !end) {
            showMessage('error', 'Invalid dates');
            return;
        }

        const result = await admin.createTournament(signer, regStart, start, end);
        if (result.success) {
            showMessage('success', `Tournament #${result.tournamentId} created!`);
            setShowCreateTournament(false);
            loadData();
        } else {
            showMessage('error', result.error || 'Failed to create tournament');
        }
    };

    const handlePausePackOpener = async () => {
        const signer = await getSigner();
        if (!signer) return;

        try {
            await admin.pausePackOpener(signer);
            showMessage('success', 'PackOpener paused');
        } catch (e: any) {
            showMessage('error', e.message);
        }
    };

    const handleUnpausePackOpener = async () => {
        const signer = await getSigner();
        if (!signer) return;

        try {
            await admin.unpausePackOpener(signer);
            showMessage('success', 'PackOpener unpaused');
        } catch (e: any) {
            showMessage('error', e.message);
        }
    };

    // Don't render if not admin
    if (!isConnected || !userIsAdmin) {
        return null;
    }

    return (
        <div className="animate-[fadeInUp_0.5s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-500/20 rounded-xl">
                        <Shield className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white">Admin Panel</h2>
                        <p className="text-gray-500 text-sm font-mono">{address?.slice(0, 10)}...</p>
                    </div>
                </div>
                <button
                    onClick={loadData}
                    disabled={isRefreshing}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                    <RefreshCw className={`w-5 h-5 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Message */}
            {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success'
                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                    : 'bg-red-500/20 border border-red-500/30 text-red-400'
                    }`}>
                    {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                    <p className="text-gray-500 text-xs uppercase mb-1">Packs Sold</p>
                    <p className="text-2xl font-bold text-white font-mono">{stats?.packsSold || 0}</p>
                </div>
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                    <p className="text-gray-500 text-xs uppercase mb-1">Pack Price</p>
                    <p className="text-2xl font-bold text-yc-orange font-mono">{stats ? formatXTZ(stats.packPrice) : '5'} XTZ</p>
                </div>
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                    <p className="text-gray-500 text-xs uppercase mb-1">Total NFTs</p>
                    <p className="text-2xl font-bold text-white font-mono">{stats?.totalNFTs || 0}</p>
                </div>
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-4">
                    <p className="text-gray-500 text-xs uppercase mb-1">Active Tournament</p>
                    <p className="text-2xl font-bold text-yc-green font-mono">#{stats?.activeTournamentId || 0}</p>
                </div>
            </div>

            {/* Contract Balances */}
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-6 mb-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-yc-green" />
                    Contract Balances
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black/50 rounded-lg p-4">
                        <p className="text-gray-500 text-xs mb-1">PackOpener</p>
                        <p className="text-xl font-mono font-bold text-white">
                            {balances ? formatXTZ(balances.packOpener) : '0'} XTZ
                        </p>
                    </div>
                    <div className="bg-black/50 rounded-lg p-4">
                        <p className="text-gray-500 text-xs mb-1">TournamentManager</p>
                        <p className="text-xl font-mono font-bold text-white">
                            {balances ? formatXTZ(balances.tournament) : '0'} XTZ
                        </p>
                    </div>
                    <div className="bg-black/50 rounded-lg p-4">
                        <p className="text-gray-500 text-xs mb-1">NFT Contract</p>
                        <p className="text-xl font-mono font-bold text-white">
                            {balances ? formatXTZ(balances.nft) : '0'} XTZ
                        </p>
                    </div>
                </div>
            </div>

            {/* Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* PackOpener Controls */}
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-yc-orange" />
                        PackOpener Controls
                    </h3>

                    {/* Withdraw */}
                    <button
                        onClick={handleWithdraw}
                        disabled={admin.isLoading}
                        className="w-full mb-4 bg-yc-green hover:bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <Download className="w-5 h-5" />
                        Withdraw Funds
                    </button>

                    {/* Set Pack Price */}
                    <div className="mb-4">
                        <label className="text-gray-400 text-sm mb-2 block">Pack Price (XTZ)</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={newPackPrice}
                                onChange={(e) => setNewPackPrice(e.target.value)}
                                className="flex-1 bg-black border border-[#333] rounded-lg px-4 py-2 text-white font-mono"
                                placeholder="5"
                            />
                            <button
                                onClick={handleSetPackPrice}
                                disabled={admin.isLoading}
                                className="bg-yc-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                            >
                                Set
                            </button>
                        </div>
                    </div>

                    {/* Set Active Tournament */}
                    <div className="mb-4">
                        <label className="text-gray-400 text-sm mb-2 block">Active Tournament ID</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={newActiveTournament}
                                onChange={(e) => setNewActiveTournament(e.target.value)}
                                className="flex-1 bg-black border border-[#333] rounded-lg px-4 py-2 text-white font-mono"
                                placeholder="0"
                            />
                            <button
                                onClick={handleSetActiveTournament}
                                disabled={admin.isLoading}
                                className="bg-yc-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                            >
                                Set
                            </button>
                        </div>
                    </div>

                    {/* Pause/Unpause */}
                    <div className="flex gap-2">
                        <button
                            onClick={handlePausePackOpener}
                            className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded-lg font-bold flex items-center justify-center gap-2"
                        >
                            <Pause className="w-4 h-4" /> Pause
                        </button>
                        <button
                            onClick={handleUnpausePackOpener}
                            className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 rounded-lg font-bold flex items-center justify-center gap-2"
                        >
                            <Play className="w-4 h-4" /> Unpause
                        </button>
                    </div>
                </div>

                {/* Tournament Controls */}
                <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-yellow-500" />
                        Tournament Controls
                    </h3>

                    {/* Create Tournament */}
                    {!showCreateTournament ? (
                        <button
                            onClick={() => setShowCreateTournament(true)}
                            className="w-full mb-4 bg-yellow-500 hover:bg-yellow-600 text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Create Tournament
                        </button>
                    ) : (
                        <div className="mb-4 bg-black/50 rounded-lg p-4">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-white font-bold">New Tournament</span>
                                <button onClick={() => setShowCreateTournament(false)}>
                                    <X className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-gray-400 text-xs">Registration Start</label>
                                    <input
                                        type="datetime-local"
                                        value={tournamentForm.regStart}
                                        onChange={(e) => setTournamentForm({ ...tournamentForm, regStart: e.target.value })}
                                        className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs">Start Time</label>
                                    <input
                                        type="datetime-local"
                                        value={tournamentForm.start}
                                        onChange={(e) => setTournamentForm({ ...tournamentForm, start: e.target.value })}
                                        className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-gray-400 text-xs">End Time</label>
                                    <input
                                        type="datetime-local"
                                        value={tournamentForm.end}
                                        onChange={(e) => setTournamentForm({ ...tournamentForm, end: e.target.value })}
                                        className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-white text-sm"
                                    />
                                </div>
                                <button
                                    onClick={handleCreateTournament}
                                    disabled={admin.isLoading}
                                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black py-2 rounded-lg font-bold disabled:opacity-50"
                                >
                                    Create
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Warning */}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-400 text-sm">
                        <AlertTriangle className="w-4 h-4 inline mr-2" />
                        Tournament finalization and cancellation require additional UI. Use contract directly for now.
                    </div>
                </div>
            </div>

            {/* Tournament List */}
            <div className="mt-6 bg-[#121212] border border-[#2A2A2A] rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    All Tournaments ({tournaments.length})
                </h3>

                {tournaments.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No tournaments created yet</p>
                ) : (
                    <div className="space-y-3">
                        {tournaments.map((t) => {
                            const statusInfo = getStatusInfo(t.status);
                            const now = Date.now() / 1000;
                            const isEnded = t.endTime < now;
                            const isActive = t.startTime <= now && t.endTime >= now;
                            const isRegistration = t.registrationStart <= now && t.startTime > now;

                            return (
                                <div
                                    key={t.id}
                                    className={`bg-black/50 rounded-lg p-4 border ${stats?.activeTournamentId === t.id
                                        ? 'border-yc-green'
                                        : 'border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-white font-bold text-lg">#{t.id}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusInfo.color}`}>
                                                {statusInfo.text}
                                            </span>
                                            {stats?.activeTournamentId === t.id && (
                                                <span className="px-2 py-0.5 rounded text-xs font-bold text-yc-green bg-yc-green/20">
                                                    Active Prize Pool
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1 text-yc-orange">
                                                <DollarSign className="w-4 h-4" />
                                                <span className="font-mono">{formatXTZ(t.prizePool)} XTZ</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-gray-400">
                                                <Users className="w-4 h-4" />
                                                <span className="font-mono">{t.entryCount} entries</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-500 text-xs uppercase mb-1">Registration</p>
                                            <p className={`font-mono ${isRegistration ? 'text-blue-400' : 'text-gray-400'}`}>
                                                {formatDate(t.registrationStart)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs uppercase mb-1">Start</p>
                                            <p className={`font-mono ${isActive ? 'text-green-400' : 'text-gray-400'}`}>
                                                {formatDate(t.startTime)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 text-xs uppercase mb-1">End</p>
                                            <p className={`font-mono ${isEnded ? 'text-red-400' : 'text-gray-400'}`}>
                                                {formatDate(t.endTime)}
                                                {!isEnded && t.endTime > now && (
                                                    <span className="ml-2 text-xs text-yc-orange">
                                                        ({Math.ceil((t.endTime - now) / 3600)}h left)
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;

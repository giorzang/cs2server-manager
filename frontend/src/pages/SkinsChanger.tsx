import { useState, useEffect, useMemo } from 'react';
import { Search, X, Crosshair, Sparkles, Users, Music, Award, Hand, Trash2, Check, Sword } from 'lucide-react';
import type { Skin, WeaponCategory, SelectedSkin } from '../types/skinTypes';
import { WEAPON_CATEGORIES, WEAPON_DISPLAY_NAMES, KNIFE_DEFINDEXES, GLOVE_DISPLAY_NAMES, KNIFE_NAME_TO_DEFINDEX } from '../types/skinTypes';
import api from '../services/api';

// Extended types for new categories
interface Agent {
    team: number; // 2 = T, 3 = CT
    image: string;
    model: string;
    agent_name: string;
}

interface Glove {
    weapon_defindex: number;
    paint: number | string;
    image: string;
    paint_name: string;
}

interface MusicKit {
    id: string;
    name: string;
    image: string;
}

interface Pin {
    id: string;
    name: string;
    image: string;
}

// Knife interface (uses Skin structure)
interface Knife extends Skin {
    // Inherits from Skin: weapon_defindex, weapon_name, paint, image, paint_name
}

type MainCategory = 'weapons' | 'knives' | 'agents' | 'gloves' | 'music' | 'pins';

// Main category definitions
const MAIN_CATEGORIES = [
    { id: 'weapons' as MainCategory, name: 'Weapons', icon: Crosshair },
    { id: 'knives' as MainCategory, name: 'Knives', icon: Sword },
    { id: 'agents' as MainCategory, name: 'Agents', icon: Users },
    { id: 'gloves' as MainCategory, name: 'Gloves', icon: Hand },
    { id: 'music' as MainCategory, name: 'Music', icon: Music },
    { id: 'pins' as MainCategory, name: 'Pins', icon: Award },
];

export default function SkinsChanger() {
    // Main category state
    const [mainCategory, setMainCategory] = useState<MainCategory>('weapons');

    // Data states
    const [skins, setSkins] = useState<Skin[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [gloves, setGloves] = useState<Glove[]>([]);
    const [musicKits, setMusicKits] = useState<MusicKit[]>([]);
    const [pins, setPins] = useState<Pin[]>([]);

    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<WeaponCategory>(WEAPON_CATEGORIES[0]);
    const [selectedWeapon, setSelectedWeapon] = useState<number | null>(null);
    const [selectedKnifeType, setSelectedKnifeType] = useState<number | null>(null);
    const [selectedGloveType, setSelectedGloveType] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [selectedSkin, setSelectedSkin] = useState<Skin | null>(null);
    const [selectedKnife, setSelectedKnife] = useState<Knife | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
    const [selectedGlove, setSelectedGlove] = useState<Glove | null>(null);
    const [selectedMusic, setSelectedMusic] = useState<MusicKit | null>(null);
    const [selectedPin, setSelectedPin] = useState<Pin | null>(null);

    // Team selection for skins (CT = 3, T = 2)
    const [skinSettings, setSkinSettings] = useState<SelectedSkin & { team: 'CT' | 'T' | 'BOTH' } | null>(null);

    // Team selection for knives
    const [knifeTeam, setKnifeTeam] = useState<'CT' | 'T' | 'BOTH'>('BOTH');

    // Team selection for gloves and music
    const [gloveTeam, setGloveTeam] = useState<'CT' | 'T' | 'BOTH'>('BOTH');
    const [musicTeam, setMusicTeam] = useState<'CT' | 'T' | 'BOTH'>('BOTH');

    // User's saved preferences
    interface UserPreferences {
        skins: Array<{ 
            weapon_defindex: number; 
            weapon_paint_id: number; 
            weapon_team: number;
            weapon_wear: number;
            weapon_seed: number;
        }>;
        knives: Array<{ knife: string; weapon_team: number }>;
        agents: Array<{ agent_ct: string | null; agent_t: string | null }>;
        gloves: Array<{ weapon_defindex: number; weapon_team: number }>;
        music: Array<{ music_id: number; weapon_team: number }>;
        pin: { id: number } | null;
    }
    const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);

    // Load all data
    useEffect(() => {
        const loadData = async () => {
            try {
                const [skinsRes, agentsRes, glovesRes, musicRes, pinsRes] = await Promise.all([
                    fetch('/data/skins.json'),
                    fetch('/data/agents.json'),
                    fetch('/data/gloves.json'),
                    fetch('/data/music.json'),
                    fetch('/data/collectibles.json')
                ]);

                setSkins(await skinsRes.json());
                setAgents(await agentsRes.json());
                setGloves(await glovesRes.json());
                setMusicKits(await musicRes.json());
                setPins(await pinsRes.json());

                // Load user preferences if logged in
                try {
                    const prefsRes = await api.get('/api/skins');
                    if (prefsRes.data.success) {
                        setUserPrefs(prefsRes.data.data);
                    }
                } catch {
                    // User not logged in, ignore
                }

                setLoading(false);
            } catch (err) {
                console.error('Failed to load data:', err);
                setLoading(false);
            }
        };
        loadData();
    }, []);


    // Get unique weapons in current category
    const weaponsInCategory = useMemo(() => {
        const uniqueWeapons = new Map<number, Skin>();
        skins.forEach(skin => {
            if (selectedCategory.defindexes.includes(skin.weapon_defindex)) {
                if (!uniqueWeapons.has(skin.weapon_defindex)) {
                    uniqueWeapons.set(skin.weapon_defindex, skin);
                }
            }
        });
        return Array.from(uniqueWeapons.values());
    }, [skins, selectedCategory]);

    // Get unique knife types
    const knifeTypes = useMemo(() => {
        const uniqueKnives = new Map<number, Skin>();
        skins.forEach(skin => {
            if (KNIFE_DEFINDEXES.includes(skin.weapon_defindex)) {
                if (!uniqueKnives.has(skin.weapon_defindex)) {
                    uniqueKnives.set(skin.weapon_defindex, skin);
                }
            }
        });
        return Array.from(uniqueKnives.values());
    }, [skins]);

    // Get unique glove types
    const gloveTypes = useMemo(() => {
        const uniqueGloves = new Map<number, Glove>();
        gloves.forEach(glove => {
            if (glove.image && !uniqueGloves.has(glove.weapon_defindex)) {
                uniqueGloves.set(glove.weapon_defindex, glove);
            }
        });
        return Array.from(uniqueGloves.values());
    }, [gloves]);

    // Set default selected weapon when category changes
    useEffect(() => {
        if (weaponsInCategory.length > 0 && !selectedWeapon) {
            setSelectedWeapon(weaponsInCategory[0].weapon_defindex);
        }
    }, [weaponsInCategory, selectedWeapon]);

    // Set default selected knife type when switching to knives
    useEffect(() => {
        if (mainCategory === 'knives' && knifeTypes.length > 0 && !selectedKnifeType) {
            setSelectedKnifeType(knifeTypes[0].weapon_defindex);
        }
    }, [mainCategory, knifeTypes, selectedKnifeType]);

    // Set default selected glove type when switching to gloves
    useEffect(() => {
        if (mainCategory === 'gloves' && gloveTypes.length > 0 && !selectedGloveType) {
            setSelectedGloveType(gloveTypes[0].weapon_defindex);
        }
    }, [mainCategory, gloveTypes, selectedGloveType]);

    // Get filtered items based on main category
    const filteredItems = useMemo(() => {
        const query = searchQuery.toLowerCase();

        switch (mainCategory) {
            case 'weapons':
                if (!selectedWeapon) return [];
                let result = skins.filter(s => s.weapon_defindex === selectedWeapon);
                if (query) result = result.filter(s => s.paint_name.toLowerCase().includes(query));
                return result;

            case 'knives':
                // Filter knives by selected knife type
                if (!selectedKnifeType) return [];
                let knifeResult = skins.filter(s => s.weapon_defindex === selectedKnifeType);
                if (query) knifeResult = knifeResult.filter(k => k.paint_name.toLowerCase().includes(query));
                return knifeResult;

            case 'agents':
                let agentResult = agents.filter(a => a.image); // Filter out empty ones
                if (query) agentResult = agentResult.filter(a => a.agent_name.toLowerCase().includes(query));
                return agentResult;

            case 'gloves':
                // Filter gloves by selected glove type
                if (!selectedGloveType) return [];
                let gloveResult = gloves.filter(g => g.image && g.weapon_defindex === selectedGloveType);
                if (query) gloveResult = gloveResult.filter(g => g.paint_name.toLowerCase().includes(query));
                return gloveResult;

            case 'music':
                let musicResult = musicKits;
                if (query) musicResult = musicResult.filter(m => m.name.toLowerCase().includes(query));
                return musicResult;

            case 'pins':
                let pinResult = pins;
                if (query) pinResult = pinResult.filter(p => p.name.toLowerCase().includes(query));
                return pinResult;

            default:
                return [];
        }
    }, [mainCategory, skins, agents, gloves, musicKits, pins, selectedWeapon, selectedKnifeType, selectedGloveType, searchQuery]);

    // Handle item click based on category
    const handleItemClick = (item: unknown) => {
        switch (mainCategory) {
            case 'weapons':
                const skin = item as Skin;
                setSelectedSkin(skin);
                
                // Check if already equipped to pre-fill settings
                let initialTeam: 'CT' | 'T' | 'BOTH' = 'BOTH';
                let initialWear = 0.00;
                let initialSeed = 0;

                if (userPrefs?.skins) {
                    const matchedSkins = userPrefs.skins.filter(s =>
                        s.weapon_defindex === skin.weapon_defindex &&
                        s.weapon_paint_id === Number(skin.paint)
                    );
                    
                    if (matchedSkins.length > 0) {
                        const hasT = matchedSkins.some(s => s.weapon_team === 2);
                        const hasCT = matchedSkins.some(s => s.weapon_team === 3);
                        if (hasT && hasCT) initialTeam = 'BOTH';
                        else if (hasT) initialTeam = 'T';
                        else if (hasCT) initialTeam = 'CT';

                        // Use values from the first match (usually consistent across teams if set together)
                        initialWear = matchedSkins[0].weapon_wear;
                        initialSeed = matchedSkins[0].weapon_seed;
                    }
                }

                setSkinSettings({
                    weapon_defindex: skin.weapon_defindex,
                    paint_id: skin.paint,
                    wear: initialWear,
                    seed: initialSeed,
                    team: initialTeam
                });
                break;
            case 'knives':
                setSelectedKnife(item as Knife);
                setKnifeTeam('BOTH');
                break;
            case 'agents':
                setSelectedAgent(item as Agent);
                break;
            case 'gloves':
                setSelectedGlove(item as Glove);
                break;
            case 'music':
                setSelectedMusic(item as MusicKit);
                break;
            case 'pins':
                setSelectedPin(item as Pin);
                break;
        }
    };

    // Close all modals
    const closeModal = () => {
        setSelectedSkin(null);
        setSelectedKnife(null);
        setSelectedAgent(null);
        setSelectedGlove(null);
        setSelectedMusic(null);
        setSelectedPin(null);
        setSkinSettings(null);
        setKnifeTeam('BOTH');
        setGloveTeam('BOTH');
        setMusicTeam('BOTH');
    };

    // Refresh user preferences after changes
    const refreshPrefs = async () => {
        try {
            const prefsRes = await api.get(`/api/skins?t=${Date.now()}`);
            if (prefsRes.data.success) {
                setUserPrefs(prefsRes.data.data);
            }
        } catch {
            // Ignore errors
        }
    };

    // Handle apply - call API to save skin
    const handleApply = async () => {
        try {
            if (selectedSkin && skinSettings) {
                // Check if this is a knife (defindex 500+)
                const isKnife = selectedSkin.weapon_defindex >= 500;

                if (isKnife) {
                    // Find old knife defindex for skin cleanup
                    const teamNumber = skinSettings.team === 'T' ? 2 : skinSettings.team === 'CT' ? 3 : null;
                    let oldKnifeDefindex: number | undefined;
                    if (teamNumber && userPrefs?.knives) {
                        const oldKnife = userPrefs.knives.find(k => k.weapon_team === teamNumber);
                        if (oldKnife?.knife) {
                            oldKnifeDefindex = KNIFE_NAME_TO_DEFINDEX[oldKnife.knife];
                        }
                    }

                    // Save knife type first (using weapon_name and defindex), with team from skinSettings
                    await api.post('/api/skins/knife', {
                        knifeName: selectedSkin.weapon_name,
                        knifeDefindex: selectedSkin.weapon_defindex,
                        oldKnifeDefindex,
                        team: skinSettings.team
                    });
                }

                // Save skin/paint for the weapon
                await api.post('/api/skins/weapon', {
                    weaponDefindex: skinSettings.weapon_defindex,
                    paintId: skinSettings.paint_id,
                    wear: skinSettings.wear,
                    seed: skinSettings.seed,
                    team: skinSettings.team
                });
            } else if (selectedKnife) {
                // Find old knife defindex for skin cleanup
                const teams = knifeTeam === 'BOTH' ? [2, 3] : knifeTeam === 'T' ? [2] : [3];
                const oldKnifeDefindexes: number[] = [];
                if (userPrefs?.knives) {
                    for (const t of teams) {
                        const oldKnife = userPrefs.knives.find(k => k.weapon_team === t);
                        if (oldKnife?.knife) {
                            const defindex = KNIFE_NAME_TO_DEFINDEX[oldKnife.knife];
                            if (defindex && !oldKnifeDefindexes.includes(defindex)) {
                                oldKnifeDefindexes.push(defindex);
                            }
                        }
                    }
                }

                // Save knife type and skin
                await api.post('/api/skins/knife', {
                    knifeName: selectedKnife.weapon_name,
                    knifeDefindex: selectedKnife.weapon_defindex,
                    oldKnifeDefindex: oldKnifeDefindexes[0], // Use first one, backend handles per team
                    team: knifeTeam
                });
                await api.post('/api/skins/weapon', {
                    weaponDefindex: selectedKnife.weapon_defindex,
                    paintId: selectedKnife.paint,
                    wear: 0,
                    seed: 0,
                    team: knifeTeam
                });
            } else if (selectedAgent) {
                const team = selectedAgent.team === 2 ? 'T' : 'CT';
                await api.post('/api/skins/agent', {
                    agentModel: selectedAgent.model,
                    team
                });
            } else if (selectedGlove) {
                // Save glove type first
                await api.post('/api/skins/gloves', {
                    weaponDefindex: selectedGlove.weapon_defindex,
                    paintId: typeof selectedGlove.paint === 'string' ? parseInt(selectedGlove.paint) : selectedGlove.paint,
                    team: gloveTeam
                });
                // Also save glove skin to wp_player_skins (like knife)
                await api.post('/api/skins/weapon', {
                    weaponDefindex: selectedGlove.weapon_defindex,
                    paintId: typeof selectedGlove.paint === 'string' ? parseInt(selectedGlove.paint) : selectedGlove.paint,
                    wear: 0,
                    seed: 0,
                    team: gloveTeam
                });
            } else if (selectedMusic) {
                await api.post('/api/skins/music', {
                    musicId: parseInt(selectedMusic.id),
                    team: musicTeam
                });
            } else if (selectedPin) {
                await api.post('/api/skins/pin', {
                    pinId: parseInt(selectedPin.id)
                });
            }
            await refreshPrefs();
            closeModal();
        } catch {
            // Silent fail
        }
    };

    // Handle reset/remove - call API to delete skin
    const handleReset = async () => {
        try {
            if (selectedSkin && skinSettings) {
                // Check if this is a knife (defindex 500+)
                const isKnife = selectedSkin.weapon_defindex >= 500;

                // Delete the skin/paint
                await api.delete('/api/skins/weapon', {
                    data: {
                        weaponDefindex: skinSettings.weapon_defindex,
                        team: skinSettings.team
                    }
                });

                // Also delete knife type if it's a knife
                if (isKnife) {
                    await api.delete('/api/skins/knife', { data: { team: skinSettings.team } });
                }
            } else if (selectedKnife) {
                // Delete knife skin
                await api.delete('/api/skins/weapon', {
                    data: {
                        weaponDefindex: selectedKnife.weapon_defindex,
                        team: knifeTeam
                    }
                });
                await api.delete('/api/skins/knife', { data: { team: knifeTeam } });
            } else if (selectedAgent) {
                const team = selectedAgent.team === 2 ? 'T' : 'CT';
                await api.delete('/api/skins/agent', { data: { team } });
            } else if (selectedGlove) {
                // Delete glove skin from wp_player_skins
                await api.delete('/api/skins/weapon', {
                    data: {
                        weaponDefindex: selectedGlove.weapon_defindex,
                        team: gloveTeam
                    }
                });
                // Delete glove type
                await api.delete('/api/skins/gloves', { data: { team: gloveTeam } });
            } else if (selectedMusic) {
                await api.delete('/api/skins/music', { data: { team: musicTeam } });
            } else if (selectedPin) {
                await api.delete('/api/skins/pin');
            }
            await refreshPrefs();
            closeModal();
        } catch {
            // Silent fail
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-slate-400">Đang tải dữ liệu...</span>
                </div>
            </div>
        );
    }

    const isModalOpen = selectedSkin || selectedKnife || selectedAgent || selectedGlove || selectedMusic || selectedPin;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Hero Header */}
            <div className="relative overflow-hidden bg-gradient-to-r from-orange-600/20 via-purple-600/20 to-blue-600/20 border-b border-slate-800">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
                <div className="relative px-6 py-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/30">
                            <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Skins Changer</h1>
                            <p className="text-slate-400 mt-1">Tùy chỉnh skin vũ khí, agents, găng tay và nhiều hơn nữa</p>
                        </div>
                    </div>

                    {/* Main Category Tabs */}
                    <div className="flex gap-2 mt-6 flex-wrap">
                        {MAIN_CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setMainCategory(cat.id);
                                        setSearchQuery('');
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${mainCategory === cat.id
                                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <Icon size={18} />
                                    {cat.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex">
                {/* Sidebar - Only show for weapons */}
                {mainCategory === 'weapons' && (
                    <aside className="w-64 min-h-[calc(100vh-200px)] bg-slate-900/50 border-r border-slate-800 p-4">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Danh Mục</h3>

                        <div className="space-y-2">
                            {WEAPON_CATEGORIES.map(category => (
                                <button
                                    key={category.id}
                                    onClick={() => {
                                        setSelectedCategory(category);
                                        setSelectedWeapon(null);
                                        setSearchQuery('');
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${selectedCategory.id === category.id
                                        ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg shadow-orange-600/30'
                                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <span className="text-xl">{category.icon}</span>
                                    <span className="font-medium">{category.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Weapon List */}
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-8 mb-4">Weapons</h3>
                        <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                            {weaponsInCategory.map(weapon => (
                                <button
                                    key={weapon.weapon_defindex}
                                    onClick={() => {
                                        setSelectedWeapon(weapon.weapon_defindex);
                                        setSearchQuery('');
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${selectedWeapon === weapon.weapon_defindex
                                        ? 'bg-slate-700 text-white'
                                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                        }`}
                                >
                                    <Crosshair size={14} />
                                    <span>{WEAPON_DISPLAY_NAMES[weapon.weapon_name] || weapon.weapon_name}</span>
                                </button>
                            ))}
                        </div>
                    </aside>
                )}

                {/* Sidebar - Show for knives */}
                {mainCategory === 'knives' && (
                    <aside className="w-64 min-h-[calc(100vh-200px)] bg-slate-900/50 border-r border-slate-800 p-4">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Loại Dao</h3>
                        <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                            {knifeTypes.map(knife => (
                                <button
                                    key={knife.weapon_defindex}
                                    onClick={() => {
                                        setSelectedKnifeType(knife.weapon_defindex);
                                        setSearchQuery('');
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${selectedKnifeType === knife.weapon_defindex
                                        ? 'bg-slate-700 text-white'
                                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                        }`}
                                >
                                    <Sword size={14} />
                                    <span>{WEAPON_DISPLAY_NAMES[knife.weapon_name] || knife.weapon_name}</span>
                                </button>
                            ))}
                        </div>
                    </aside>
                )}

                {/* Sidebar - Show for gloves */}
                {mainCategory === 'gloves' && (
                    <aside className="w-64 min-h-[calc(100vh-200px)] bg-slate-900/50 border-r border-slate-800 p-4">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Loại Găng Tay</h3>
                        <div className="space-y-1 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                            {gloveTypes.map(glove => (
                                <button
                                    key={glove.weapon_defindex}
                                    onClick={() => {
                                        setSelectedGloveType(glove.weapon_defindex);
                                        setSearchQuery('');
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm ${selectedGloveType === glove.weapon_defindex
                                        ? 'bg-slate-700 text-white'
                                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                                        }`}
                                >
                                    <Hand size={14} />
                                    <span>{GLOVE_DISPLAY_NAMES[glove.weapon_defindex] || glove.paint_name}</span>
                                </button>
                            ))}
                        </div>
                    </aside>
                )}

                {/* Main Content */}
                <main className={`flex-1 p-6 ${!['weapons', 'knives', 'gloves'].includes(mainCategory) ? 'w-full' : ''}`}>
                    {/* Search Bar */}
                    <div className="mb-6">
                        <div className="relative max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={`Tìm kiếm ${MAIN_CATEGORIES.find(c => c.id === mainCategory)?.name || ''}...`}
                                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Items Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {(filteredItems as unknown[]).map((item, index) => {
                            // Determine item properties based on category
                            let image = '';
                            let name = '';
                            let subtext = '';
                            let badge: string | null = null;

                            switch (mainCategory) {
                                case 'weapons':
                                    const skin = item as Skin;
                                    image = skin.image;
                                    name = skin.paint_name.split('|')[1]?.trim() || skin.paint_name;
                                    subtext = WEAPON_DISPLAY_NAMES[skin.weapon_name] || skin.weapon_name;
                                    if (skin.paint === 0) badge = 'Mặc định';
                                    break;
                                case 'knives':
                                    const knife = item as Knife;
                                    image = knife.image;
                                    name = knife.paint_name.split('|')[1]?.trim() || knife.paint_name;
                                    subtext = WEAPON_DISPLAY_NAMES[knife.weapon_name] || knife.weapon_name;
                                    if (knife.paint === 0) badge = 'Mặc định';
                                    break;
                                case 'agents':
                                    const agent = item as Agent;
                                    image = agent.image;
                                    name = agent.agent_name;
                                    subtext = agent.team === 2 ? '🔴 Terrorist' : '🔵 Counter-Terrorist';
                                    break;
                                case 'gloves':
                                    const glove = item as Glove;
                                    image = glove.image;
                                    name = glove.paint_name;
                                    if (glove.paint === 0) badge = 'Mặc định';
                                    break;
                                case 'music':
                                    const music = item as MusicKit;
                                    image = music.image;
                                    name = music.name;
                                    break;
                                case 'pins':
                                    const pin = item as Pin;
                                    image = pin.image;
                                    name = pin.name;
                                    break;
                            }

                            // Check if this item is selected by user and get the team
                            let isSelected = false;
                            let selectedTeam: 'T' | 'CT' | 'BOTH' | null = null;
                            if (userPrefs) {
                                switch (mainCategory) {
                                    case 'weapons':
                                        const skinItem = item as Skin;
                                        // Check if skin is selected and get the team
                                        // Fix: Check all entries to correctly identify 'BOTH'
                                        const matchedSkins = userPrefs.skins.filter(s =>
                                            s.weapon_defindex === skinItem.weapon_defindex &&
                                            s.weapon_paint_id === Number(skinItem.paint)
                                        );
                                        
                                        // For knives, also check if knife type matches
                                        let weaponKnifeTypeMatches = true;
                                        if (skinItem.weapon_defindex >= 500 && userPrefs.knives.length > 0) {
                                            // Check if any knife entry matches the weapon_name
                                            weaponKnifeTypeMatches = userPrefs.knives.some(k => k.knife === skinItem.weapon_name);
                                        }
                                        
                                        isSelected = matchedSkins.length > 0 && weaponKnifeTypeMatches;

                                        // Determine team from weapon_team: 0=BOTH (legacy?), 2=T, 3=CT
                                        if (isSelected && matchedSkins.length > 0) {
                                            const hasT = matchedSkins.some(s => Number(s.weapon_team) === 2);
                                            const hasCT = matchedSkins.some(s => Number(s.weapon_team) === 3);
                                            
                                            if (hasT && hasCT) selectedTeam = 'BOTH';
                                            else if (hasT) selectedTeam = 'T';
                                            else if (hasCT) selectedTeam = 'CT';
                                        }
                                        break;
                                    case 'knives':
                                        const knifeItem = item as Knife;
                                        // Check if knife type matches and skin is selected
                                        const matchedKnifeSkin = userPrefs.skins.find(s =>
                                            s.weapon_defindex === knifeItem.weapon_defindex &&
                                            s.weapon_paint_id === Number(knifeItem.paint)
                                        );
                                        const knifeTypeMatches = userPrefs.knives.some(k => k.knife === knifeItem.weapon_name);
                                        isSelected = !!matchedKnifeSkin && knifeTypeMatches;
                                        if (matchedKnifeSkin) {
                                            // Check if both teams have this knife
                                            const allKnifeSkins = userPrefs.skins.filter(s =>
                                                s.weapon_defindex === knifeItem.weapon_defindex &&
                                                s.weapon_paint_id === Number(knifeItem.paint)
                                            );
                                            const hasKnifeT = allKnifeSkins.some(s => s.weapon_team === 2);
                                            const hasKnifeCT = allKnifeSkins.some(s => s.weapon_team === 3);
                                            selectedTeam = (hasKnifeT && hasKnifeCT) ? 'BOTH' : hasKnifeT ? 'T' : 'CT';
                                        }
                                        break;
                                    case 'agents':
                                        const agentItem = item as Agent;
                                        // New schema: agents have agent_ct and agent_t columns
                                        const agentRow = userPrefs.agents[0]; // Only one row per user
                                        if (agentRow) {
                                            if (agentItem.team === 3 && agentRow.agent_ct === agentItem.model) {
                                                isSelected = true;
                                                selectedTeam = 'CT';
                                            } else if (agentItem.team === 2 && agentRow.agent_t === agentItem.model) {
                                                isSelected = true;
                                                selectedTeam = 'T';
                                            }
                                        }
                                        break;
                                    case 'gloves':
                                        const gloveItem = item as Glove;
                                        // Check if glove skin is selected in wp_player_skins (like knives)
                                        const glovePaintId = typeof gloveItem.paint === 'string' ? parseInt(gloveItem.paint) : gloveItem.paint;
                                        const matchedGloveSkins = userPrefs.skins.filter(s =>
                                            s.weapon_defindex === gloveItem.weapon_defindex &&
                                            s.weapon_paint_id === glovePaintId
                                        );
                                        // Also check if glove type exists in wp_player_gloves
                                        const gloveTypeMatches = userPrefs.gloves.some(g => g.weapon_defindex === gloveItem.weapon_defindex);
                                        isSelected = matchedGloveSkins.length > 0 && gloveTypeMatches;
                                        if (matchedGloveSkins.length > 0) {
                                            // Check if both teams have this glove
                                            const hasGloveT = matchedGloveSkins.some(s => s.weapon_team === 2);
                                            const hasGloveCT = matchedGloveSkins.some(s => s.weapon_team === 3);
                                            selectedTeam = (hasGloveT && hasGloveCT) ? 'BOTH' : hasGloveT ? 'T' : 'CT';
                                        }
                                        break;
                                    case 'music':
                                        const musicItem = item as MusicKit;
                                        const matchedMusicItems = userPrefs.music.filter(m => m.music_id === parseInt(musicItem.id));
                                        isSelected = matchedMusicItems.length > 0;
                                        if (matchedMusicItems.length > 0) {
                                            // Check if both teams have this music
                                            const hasMusicT = matchedMusicItems.some(m => m.weapon_team === 2);
                                            const hasMusicCT = matchedMusicItems.some(m => m.weapon_team === 3);
                                            selectedTeam = (hasMusicT && hasMusicCT) ? 'BOTH' : hasMusicT ? 'T' : 'CT';
                                        }
                                        break;
                                    case 'pins':
                                        const pinItem = item as Pin;
                                        isSelected = userPrefs.pin?.id === parseInt(pinItem.id);
                                        // Pins are always for both teams
                                        if (isSelected) selectedTeam = 'BOTH';
                                        break;
                                }
                            }

                            // Get border and indicator colors based on team
                            const getTeamColors = () => {
                                if (!isSelected) return { border: 'border-slate-700/50', ring: '', bg: '' };
                                switch (selectedTeam) {
                                    case 'T':
                                        return { border: 'border-yellow-500', ring: 'ring-2 ring-yellow-500/30', bg: 'bg-yellow-500 shadow-yellow-500/50' };
                                    case 'CT':
                                        return { border: 'border-blue-500', ring: 'ring-2 ring-blue-500/30', bg: 'bg-blue-500 shadow-blue-500/50' };
                                    case 'BOTH':
                                    default:
                                        return { border: 'border-green-500', ring: 'ring-2 ring-green-500/30', bg: 'bg-green-500 shadow-green-500/50' };
                                }
                            };
                            const teamColors = getTeamColors();

                            return (
                                <div
                                    key={`${mainCategory}-${index}`}
                                    onClick={() => handleItemClick(item)}
                                    className={`group relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm border rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-500/50 ${teamColors.border} ${teamColors.ring}`}
                                >
                                    {/* Selected Indicator */}
                                    {isSelected && (
                                        <div className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full flex items-center justify-center shadow-lg ${teamColors.bg}`}>
                                            <Check size={14} className="text-white" />
                                        </div>
                                    )}

                                    {/* Glow effect */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/10 group-hover:to-transparent transition-all duration-300" />

                                    {/* Image */}
                                    <div className="relative p-4 pt-6">
                                        <img
                                            src={image}
                                            alt={name}
                                            loading="lazy"
                                            className="w-full h-24 object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-lg"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x100?text=No+Image';
                                            }}
                                        />
                                    </div>

                                    {/* Info */}
                                    <div className="p-3 pt-0">
                                        <h4 className="text-sm font-medium text-white truncate group-hover:text-orange-400 transition-colors">
                                            {name}
                                        </h4>
                                        {subtext && (
                                            <p className="text-xs text-slate-500 truncate mt-0.5">{subtext}</p>
                                        )}
                                    </div>

                                    {/* Badge */}
                                    {badge && (
                                        <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                            {badge}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {filteredItems.length === 0 && (
                        <div className="text-center py-20">
                            <div className="text-6xl mb-4">🔍</div>
                            <h3 className="text-xl font-semibold text-white mb-2">Không tìm thấy kết quả</h3>
                            <p className="text-slate-400">Thử tìm kiếm với từ khóa khác</p>
                        </div>
                    )}
                </main>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={closeModal}
                >
                    <div
                        className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header with Image */}
                        <div className="relative bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-8">
                            <button
                                onClick={closeModal}
                                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                            <img
                                src={
                                    selectedSkin?.image ||
                                    selectedKnife?.image ||
                                    selectedAgent?.image ||
                                    selectedGlove?.image ||
                                    selectedMusic?.image ||
                                    selectedPin?.image || ''
                                }
                                alt="Item"
                                className="w-full h-40 object-contain drop-shadow-2xl"
                            />
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-white mb-1">
                                {selectedSkin?.paint_name ||
                                    selectedKnife?.paint_name ||
                                    selectedAgent?.agent_name ||
                                    selectedGlove?.paint_name ||
                                    selectedMusic?.name ||
                                    selectedPin?.name}
                            </h2>

                            {selectedAgent && (
                                <p className="text-slate-400 mb-4">
                                    {selectedAgent.team === 2 ? '🔴 Terrorist' : '🔵 Counter-Terrorist'}
                                </p>
                            )}

                            {/* Team Selection for Skins */}
                            {selectedSkin && skinSettings && (
                                <>
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-300 mb-3">Áp dụng cho Team</label>
                                        <div className="flex gap-2">
                                            {(['CT', 'T', 'BOTH'] as const).map(team => (
                                                <button
                                                    key={team}
                                                    onClick={() => setSkinSettings({ ...skinSettings, team })}
                                                    className={`flex-1 py-3 rounded-xl font-medium transition-all ${skinSettings.team === team
                                                        ? team === 'CT'
                                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                            : team === 'T'
                                                                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                                                : 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                                                        }`}
                                                >
                                                    {team === 'CT' ? '🔵 CT' : team === 'T' ? '🔴 T' : '⚪ Cả hai'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Wear Slider */}
                                    <div className="mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-medium text-slate-300">Độ Mòn (Wear)</label>
                                            <span className="text-sm text-orange-400 font-mono">{skinSettings.wear.toFixed(2)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={skinSettings.wear}
                                            onChange={e => setSkinSettings({ ...skinSettings, wear: parseFloat(e.target.value) })}
                                            className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-orange-500"
                                        />
                                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                                            <span>Factory New</span>
                                            <span>Battle-Scarred</span>
                                        </div>
                                    </div>

                                    {/* Seed Input */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-300 mb-2">Pattern Seed</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="1000"
                                            value={skinSettings.seed}
                                            onChange={e => setSkinSettings({ ...skinSettings, seed: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-slate-700/50 border border-slate-600 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                                            placeholder="0 - 1000"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Team Selection for Knives */}
                            {selectedKnife && (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-300 mb-3">Áp dụng cho Team</label>
                                    <div className="flex gap-2">
                                        {(['CT', 'T', 'BOTH'] as const).map(team => (
                                            <button
                                                key={team}
                                                onClick={() => setKnifeTeam(team)}
                                                className={`flex-1 py-3 rounded-xl font-medium transition-all ${knifeTeam === team
                                                    ? team === 'CT'
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                        : team === 'T'
                                                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                                            : 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {team === 'CT' ? '🔵 CT' : team === 'T' ? '🔴 T' : '⚪ Cả hai'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Team Selection for Gloves */}
                            {selectedGlove && (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-300 mb-3">Áp dụng cho Team</label>
                                    <div className="flex gap-2">
                                        {(['CT', 'T', 'BOTH'] as const).map(team => (
                                            <button
                                                key={team}
                                                onClick={() => setGloveTeam(team)}
                                                className={`flex-1 py-3 rounded-xl font-medium transition-all ${gloveTeam === team
                                                    ? team === 'CT'
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                        : team === 'T'
                                                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                                            : 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {team === 'CT' ? '🔵 CT' : team === 'T' ? '🔴 T' : '⚪ Cả hai'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Team Selection for Music */}
                            {selectedMusic && (
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-300 mb-3">Áp dụng cho Team</label>
                                    <div className="flex gap-2">
                                        {(['CT', 'T', 'BOTH'] as const).map(team => (
                                            <button
                                                key={team}
                                                onClick={() => setMusicTeam(team)}
                                                className={`flex-1 py-3 rounded-xl font-medium transition-all ${musicTeam === team
                                                    ? team === 'CT'
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                        : team === 'T'
                                                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                                            : 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                                                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {team === 'CT' ? '🔵 CT' : team === 'T' ? '🔴 T' : '⚪ Cả hai'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}


                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                {/* Reset Button */}
                                <button
                                    onClick={handleReset}
                                    className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-700/50 hover:bg-red-600/80 text-slate-400 hover:text-white font-medium rounded-xl transition-all duration-200 border border-slate-600 hover:border-red-500"
                                    title="Xóa skin đã chọn"
                                >
                                    <Trash2 size={20} />
                                    <span className="hidden sm:inline">Xóa</span>
                                </button>

                                {/* Apply Button */}
                                <button
                                    onClick={handleApply}
                                    className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-orange-600/30 hover:shadow-orange-600/50"
                                >
                                    Áp Dụng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

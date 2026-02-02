import { Socket } from 'socket.io-client';

export interface User {
  id: string;
  username: string;
  avatar_url: string;
  is_admin: number;
}

export interface MapData {
  map_key: string;      // de_mirage
  display_name: string; // Mirage
  image_url: string;
}

export interface VetoLog {
  team: 'TEAM1' | 'TEAM2';
  map: string;
  action: 'BAN' | 'PICK' | 'SIDE_PICK';
  side?: 'CT' | 'T'; // Chỉ có nếu action là SIDE_PICK
  time: string;
}

export interface Match {
  id: number;
  display_name: string;
  team1_name: string;
  team2_name: string;
  series_type: 'BO1' | 'BO3' | 'BO5';
  status: 'PENDING' | 'PICKING' | 'VETO' | 'LIVE' | 'FINISHED' | 'CANCELLED';
  server_id: number;
  server_name?: string;
  ip?: string;
  port?: number;
  user_id?: string;
  admin_name?: string;

  // Settings & Captain
  is_veto_enabled?: number; // 0 or 1
  is_captain_mode?: number; // 0 or 1
  game_mode?: 'competitive' | 'wingman'; // 5v5 or 2v2
  captain1_id?: string;
  captain2_id?: string;
  pre_selected_maps?: string[] | null;

  // Tournament info
  tournament_id?: number;
  bracket_round?: number;
  bracket_match_index?: number;

  veto_log: VetoLog[] | null;
  map_result: string | null;

  winner_team?: string;
  team1_series_score?: number;
  team2_series_score?: number;

  created_at: string;
}

export interface Tournament {
  id: number;
  name: string;
  status: 'REGISTRATION' | 'ONGOING' | 'FINISHED';
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION';
  max_teams: number;
  created_at: string;
  matches?: Match[];
}

export interface Participant {
  match_id: number;
  user_id: string;
  team: 'TEAM1' | 'TEAM2' | 'SPECTATOR' | 'WAITING';
  username: string;
  avatar_url: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  author_id: string;
  username: string;
  avatar_url: string;
  created_at: string;
  comment_count?: number;
}

export interface Comment {
  id: number;
  content: string;
  post_id: number;
  author_id: string;
  username: string;
  avatar_url: string;
  created_at: string;
}

export interface MatchContextType {
  match: Match;
  participants: Participant[];
  socket: Socket | null;
  mapPool: MapData[];
  isAdmin: boolean;
  isLocked: boolean;
  handleJoin: (team: 'TEAM1' | 'TEAM2' | 'SPECTATOR' | 'WAITING') => Promise<void>;
  handleStartMatch: () => Promise<void>;
}
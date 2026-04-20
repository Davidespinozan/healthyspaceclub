import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';

export default function MiHuella({ onBack }: { onBack: () => void }) {
  const { userName, setUserName, streakCount, hsmUnlockDays, obData } = useAppStore();
  const userId = obData.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';

  const [profile, setProfile] = useState({ display_name: '', bio: '', avatar_url: '' });
  const [postCount, setPostCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Load profile
  useEffect(() => {
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile({ display_name: data.display_name, bio: data.bio, avatar_url: data.avatar_url });
          setEditName(data.display_name);
          setEditBio(data.bio);
        } else {
          // Create profile if doesn't exist
          const name = userName || 'Anónimo';
          supabase.from('user_profiles').insert({ user_id: userId, display_name: name, bio: '', avatar_url: '' });
          setProfile({ display_name: name, bio: '', avatar_url: '' });
          setEditName(name);
        }
      });

    // Count posts
    supabase
      .from('club_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .then(({ count }) => { if (count != null) setPostCount(count); });
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    const savedName = editName.trim() || userName || 'Anónimo';
    const savedBio = editBio.trim().slice(0, 100);
    await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        display_name: savedName,
        bio: savedBio,
        avatar_url: profile.avatar_url,
      }, { onConflict: 'user_id' });
    setProfile(prev => ({ ...prev, display_name: savedName, bio: savedBio }));
    setUserName(savedName);
    setEditing(false);
    setSaving(false);
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `${userId}.${ext}`;
    await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl + '?t=' + Date.now();
    await supabase
      .from('user_profiles')
      .upsert({
        user_id: userId,
        display_name: profile.display_name || userName || 'Anónimo',
        bio: profile.bio || '',
        avatar_url: url,
      }, { onConflict: 'user_id' });
    setProfile(prev => ({ ...prev, avatar_url: url }));
  }

  return (
    <div className="hu-wrap">
      <button className="sub-back" onClick={onBack}>← Volver</button>

      <div className="hu-header">
        <label className="hu-avatar-wrap">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className="hu-avatar-img" />
            : <div className="hu-avatar-placeholder">{(profile.display_name || '?')[0].toUpperCase()}</div>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
          <div className="hu-avatar-edit">Cambiar</div>
        </label>

        {!editing ? (
          <div className="hu-info">
            <div className="hu-name">{profile.display_name || userName}</div>
            {profile.bio && <div className="hu-bio">{profile.bio}</div>}
            <button className="hu-edit-btn" onClick={() => setEditing(true)}>Editar perfil</button>
          </div>
        ) : (
          <div className="hu-info">
            <input
              className="hu-edit-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Nombre público"
            />
            <input
              className="hu-edit-input"
              value={editBio}
              onChange={e => setEditBio(e.target.value.slice(0, 100))}
              placeholder="Bio corta (máx 100)"
            />
            <div className="hu-edit-actions">
              <button className="hu-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="hu-cancel-btn" onClick={() => setEditing(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div className="hu-stats">
        <div className="hu-stat">
          <div className="hu-stat-val">{streakCount}</div>
          <div className="hu-stat-lbl">Racha</div>
        </div>
        <div className="hu-stat">
          <div className="hu-stat-val">{hsmUnlockDays.length}</div>
          <div className="hu-stat-lbl">Días activos</div>
        </div>
        <div className="hu-stat">
          <div className="hu-stat-val">{postCount}</div>
          <div className="hu-stat-lbl">Posts</div>
        </div>
      </div>
    </div>
  );
}

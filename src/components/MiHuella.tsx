import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { useCurrentUserId } from '../hooks/useCurrentUserId';
import { supabase } from '../lib/supabase';
import { uploadAvatar } from '../utils/uploadAvatar';
import { ArrowLeft } from 'lucide-react';
import { useT } from '../i18n';

export default function MiHuella({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { userName, setUserName, streakCount } = useAppStore(useShallow((s) => ({ userName: s.userName, setUserName: s.setUserName, streakCount: s.streakCount })));
  const userId = useCurrentUserId();

  const [profile, setProfile] = useState({ display_name: '', bio: '', avatar_url: '' });
  const [postCount, setPostCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Load profile
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
        if (data) {
          setProfile({ display_name: data.display_name, bio: data.bio, avatar_url: data.avatar_url });
          setEditName(data.display_name);
          setEditBio(data.bio);
        } else {
          // Create profile if doesn't exist
          const name = userName || t('common.anonymous');
          try {
            await supabase.from('user_profiles').insert({ user_id: userId, display_name: name, bio: '', avatar_url: '' });
          } catch (e) { console.warn('[MiHuella] mutation failed:', e); }
          setProfile({ display_name: name, bio: '', avatar_url: '' });
          setEditName(name);
        }
      } catch (e) { console.warn('[MiHuella] query failed:', e); }
    })();

    // Count posts
    (async () => {
      try {
        const { count } = await supabase
          .from('club_posts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId);
        if (count != null) setPostCount(count);
      } catch (e) { console.warn('[MiHuella] query failed:', e); }
    })();
  }, [userId]);

  async function handleSave() {
    setSaving(true);
    const savedName = editName.trim() || userName || t('common.anonymous');
    const savedBio = editBio.trim().slice(0, 100);
    try {
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          display_name: savedName,
          bio: savedBio,
          avatar_url: profile.avatar_url,
        }, { onConflict: 'user_id' });
    } catch (e) { console.warn('[MiHuella] mutation failed:', e); }
    setProfile(prev => ({ ...prev, display_name: savedName, bio: savedBio }));
    setUserName(savedName);
    setEditing(false);
    setSaving(false);
  }

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadAvatar(file, userId);
    if (result.errorKey) {
      alert(t(result.errorKey, result.errorParams));
      return;
    }

    try {
      await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          display_name: profile.display_name || userName || t('common.anonymous'),
          bio: profile.bio || '',
          avatar_url: result.url,
        }, { onConflict: 'user_id' });
      setProfile(prev => ({ ...prev, avatar_url: result.url }));
    } catch (e) {
      console.warn('[MiHuella] mutation failed:', e);
    }
  }

  return (
    <div className="hu-wrap">
      <button className="sub-back" onClick={onBack}><ArrowLeft size={14} strokeWidth={2} style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden="true" /> {t('common.back')}</button>

      <div className="hu-header">
        <label className="hu-avatar-wrap">
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" className="hu-avatar-img" />
            : <div className="hu-avatar-placeholder">{(profile.display_name || '?')[0].toUpperCase()}</div>
          }
          <input type="file" accept="image/*" onChange={handleAvatar} hidden />
          <div className="hu-avatar-edit">{t('profile.change')}</div>
        </label>

        {!editing ? (
          <div className="hu-info">
            <div className="hu-name">{profile.display_name || userName}</div>
            {profile.bio && <div className="hu-bio">{profile.bio}</div>}
            <button className="hu-edit-btn" onClick={() => setEditing(true)}>{t('profile.editProfile')}</button>
          </div>
        ) : (
          <div className="hu-info">
            <input
              className="hu-edit-input"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder={t('profile.editNamePlaceholder')}
            />
            <input
              className="hu-edit-input"
              value={editBio}
              onChange={e => setEditBio(e.target.value.slice(0, 100))}
              placeholder={t('profile.editBioPlaceholder')}
            />
            <div className="hu-edit-actions">
              <button className="hu-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
              <button className="hu-cancel-btn" onClick={() => setEditing(false)}>{t('common.cancel')}</button>
            </div>
          </div>
        )}
      </div>

      <div className="hu-stats">
        <div className="hu-stat">
          <div className="hu-stat-val">{streakCount}</div>
          <div className="hu-stat-lbl">{t('profile.statStreak')}</div>
        </div>
        <div className="hu-stat">
          <div className="hu-stat-val">{postCount}</div>
          <div className="hu-stat-lbl">{t('profile.statPosts')}</div>
        </div>
      </div>
    </div>
  );
}

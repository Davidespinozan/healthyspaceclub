import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { validateMediaFile } from '../utils/mediaValidation';
import { compressImageSquare } from '../utils/imageCompress';

interface Props {
  open: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

export default function CreatePostModal({ open, onClose, onPostCreated }: Props) {
  const { userName, streakCount, dailyWorkout, obData } = useAppStore();
  const userId = obData?.name ? String(obData.name).toLowerCase().replace(/\s+/g, '_') : 'anon';

  const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [shareText, setShareText] = useState('');
  const [shareMedia, setShareMedia] = useState<File | null>(null);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const workoutToday = dailyWorkout?.date === today ? dailyWorkout.plan as Record<string, unknown> : null;
  const workoutSummary = workoutToday
    ? `${(workoutToday as Record<string, unknown>).type || 'Entrenamiento'} · ${(workoutToday as Record<string, unknown>).duration || ''}`
    : '';

  // Fetch user's avatar so the INSERT carries it
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq('user_id', userId)
          .single();
        if (data?.avatar_url) setUserAvatarUrl(data.avatar_url);
      } catch (e) { console.warn('[CreatePostModal] query failed:', e); }
    })();
  }, [userId]);

  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateMediaFile(file, true);
    if (!check.valid) { alert(check.error); return; }
    setShareMedia(file);
    setSharePreview(URL.createObjectURL(file));
  }

  function clearMedia() {
    setShareMedia(null);
    if (sharePreview) URL.revokeObjectURL(sharePreview);
    setSharePreview(null);
  }

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    let success = false;
    try {
      let photoUrl = '';
      if (shareMedia) {
        const isImage = shareMedia.type.startsWith('image/');
        const compressed = isImage ? await compressImageSquare(shareMedia) : shareMedia;
        const ext = isImage ? 'jpg' : (shareMedia.name.split('.').pop() || 'bin');
        const path = `${userId}_${Date.now()}.${ext}`;
        await supabase.storage.from('club').upload(path, compressed, {
          contentType: isImage ? 'image/jpeg' : shareMedia.type,
        });
        const { data } = supabase.storage.from('club').getPublicUrl(path);
        photoUrl = data.publicUrl;
      }
      await supabase.from('club_posts').insert({
        user_id: userId,
        username: userName || 'Anónimo',
        avatar_url: userAvatarUrl,
        streak: streakCount,
        workout_summary: workoutSummary,
        photo_url: photoUrl,
        text: shareText.trim().slice(0, 150),
        fire_count: 0,
      });
      success = true;
    } catch (e) { console.warn('[CreatePostModal] mutation failed:', e); }
    setShareText('');
    clearMedia();
    setSharing(false);
    if (success) onPostCreated?.();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="st-share-backdrop" onClick={() => { clearMedia(); onClose(); }}>
      <div className="st-share" onClick={e => e.stopPropagation()}>
        <div className="cl-modal-handle" />

        {sharePreview ? (
          <div className="st-share-preview">
            {shareMedia?.type.startsWith('video/')
              ? <video src={sharePreview} className="st-share-media" controls />
              : <img src={sharePreview} alt="" className="st-share-media" />
            }
            <button className="st-share-remove" onClick={clearMedia}>✕</button>
          </div>
        ) : (
          <label className="st-share-picker">
            <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} hidden />
            <div className="st-share-picker-icon">📷</div>
            <div className="st-share-picker-text">Foto o video</div>
          </label>
        )}

        <textarea
          className="cl-modal-input"
          placeholder="¿Cómo te fue hoy?"
          maxLength={150}
          value={shareText}
          onChange={e => setShareText(e.target.value)}
        />

        <div className="st-share-meta">
          <span className="st-share-count">{shareText.length}/150</span>
          {workoutSummary && <span className="st-share-workout">{workoutSummary}</span>}
        </div>

        <button
          className="cl-modal-submit"
          onClick={handleShare}
          disabled={sharing || (!shareText.trim() && !shareMedia)}
        >
          {sharing ? 'Publicando...' : 'Compartir'}
        </button>
      </div>
    </div>
  );
}

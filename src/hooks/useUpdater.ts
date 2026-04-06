import { useState, useEffect } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const delay = setTimeout(async () => {
      try {
        const found = await check();
        if (!cancelled && found?.available) {
          setUpdate(found);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearTimeout(delay);
    };
  }, []);

  async function installUpdate() {
    if (!update) return;
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (e) {
      setInstalling(false);
      setError(String(e));
    }
  }

  function dismiss() {
    setUpdate(null);
  }

  return { update, installing, error, installUpdate, dismiss };
}

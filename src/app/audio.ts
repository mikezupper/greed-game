/** Optional local cue, enabled only by an explicit player gesture. */
export function attachAudio(): () => void {
  let enabled = false, audio: AudioContext | undefined;
  const cue = () => {
    if (!enabled || !audio || audio.state !== 'running') return;
    const tone = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime;
    tone.type = 'sine'; tone.frequency.setValueAtTime(440, start); tone.frequency.exponentialRampToValueAtTime(660, start + 0.08);
    gain.gain.setValueAtTime(0.025, start); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
    tone.connect(gain); gain.connect(audio.destination); tone.start(); tone.stop(start + 0.17);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
  };
  const toggle = (event: Event) => {
    enabled = event instanceof CustomEvent && event.detail === true;
    if (enabled) { audio ??= new AudioContext(); void audio.resume().then(cue).catch(() => { enabled = false; }); }
  };
  document.addEventListener('greed-sound', toggle); document.addEventListener('greed-roll-complete', cue);
  return () => { document.removeEventListener('greed-sound', toggle); document.removeEventListener('greed-roll-complete', cue); void audio?.close(); };
}

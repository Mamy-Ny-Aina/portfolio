import { voiceLevel } from './voice';

export type OrbState = 'idle' | 'thinking' | 'speaking' | 'listening';

/** Orbe lumineuse du guide : respire au repos, tourne quand il réfléchit, pulse quand il parle. */
export function Orb({ size = 44, state = 'idle' }: { size?: number; state?: OrbState }) {
  const level = state === 'speaking' ? voiceLevel.value : 0;
  return (
    <span class="orb" data-state={state} style={{ '--size': `${size}px`, '--level': level.toFixed(3) }} aria-hidden="true">
      <span class="orb__core" />
      <span class="orb__ring" />
    </span>
  );
}

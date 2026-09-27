import { ParticlesOrb } from '@/registry/orbe/particles-orb/particles-orb';

export const Assistant = () => (
  <ParticlesOrb
    state="connecting"
    size={128}
    speed={0.5}
    colorFrom="#f0abfc"
    colorTo="#818cf8"
  />
);

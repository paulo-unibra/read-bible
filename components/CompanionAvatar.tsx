import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import CompanionFace from './CompanionFace';
import { CompanionMood, getCompanion } from '../utils/readingCompanion';

export default function CompanionAvatar({ seed, mood, sleeping = false }: { seed: number; mood: CompanionMood; sleeping?: boolean }) {
  const pet = getCompanion(seed);
  return (
            <Svg width={88} height={96} viewBox="0 0 24 26">
              <Ellipse cx={12} cy={24} rx={8} ry={1} fill="#DCE6E8" />
              {/* Rounded ears overlap the head so the silhouette stays connected. */}
              {pet.kind !== 'chick' && <>
                <Circle cx={6} cy={7} r={2.8} fill={pet.color} />
                <Circle cx={18} cy={7} r={2.8} fill={pet.color} />
                <Circle cx={6} cy={7} r={1.4} fill="#FFF3DC" />
                <Circle cx={18} cy={7} r={1.4} fill="#FFF3DC" />
              </>}
              <Rect x={6} y={15} width={12} height={7} rx={3} fill={pet.color} />
              <Rect x={6.5} y={20} width={3.5} height={3} rx={1.5} fill={pet.color} />
              <Rect x={14} y={20} width={3.5} height={3} rx={1.5} fill={pet.color} />
              <Rect x={3} y={13} width={4} height={6} rx={2} fill={pet.color} />
              <Rect x={17} y={13} width={4} height={6} rx={2} fill={pet.color} />
              <Rect x={7.5} y={17} width={9} height={4} rx={2} fill="#FFF3DC" />
              <Rect x={3} y={7} width={18} height={11} rx={2.5} fill={pet.color} />
              <Ellipse cx={6.5} cy={15} rx={1.5} ry={0.6} fill="#D47773" />
              <Ellipse cx={17.5} cy={15} rx={1.5} ry={0.6} fill="#D47773" />
              <CompanionFace mood={mood} sleeping={sleeping} />
              {pet.kind === 'chick' && <Path d="M11 13.8H13L12 14.8Z" fill="#C97922" />}
            </Svg>
  );
}

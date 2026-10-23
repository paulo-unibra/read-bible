import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import CompanionFace from './CompanionFace';
import { CompanionMood, getCompanion } from '../utils/readingCompanion';

export default function CompanionAvatar({ seed, mood, sleeping = false, catalogVersion = 1 }: {
  seed: number; mood: CompanionMood; sleeping?: boolean; catalogVersion?: 1 | 2;
}) {
  const pet = getCompanion(seed, catalogVersion);
  const modern = catalogVersion === 2;
  const roundEars = !modern || pet.kind === 'bear' || pet.kind === 'panda';
  return (
    <Svg width={88} height={96} viewBox="0 0 24 26">
      <Ellipse cx={12} cy={24} rx={8} ry={1} fill="#DCE6E8" />
      {roundEars && pet.kind !== 'chick' && <>
        <Circle cx={6} cy={7} r={2.8} fill={pet.kind === 'panda' ? '#59656F' : pet.color} />
        <Circle cx={18} cy={7} r={2.8} fill={pet.kind === 'panda' ? '#59656F' : pet.color} />
        <Circle cx={6} cy={7} r={1.4} fill="#FFF3DC" />
        <Circle cx={18} cy={7} r={1.4} fill="#FFF3DC" />
      </>}
      {modern && pet.kind === 'bunny' && <>
        <Rect x={5} y={0.7} width={4} height={9} rx={2} fill={pet.color} />
        <Rect x={15} y={0.7} width={4} height={9} rx={2} fill={pet.color} />
        <Path d="M7 3V7M17 3V7" stroke="#FFF3DC" strokeWidth={1.5} strokeLinecap="round" />
      </>}
      {modern && (pet.kind === 'cat' || pet.kind === 'fox') && <>
        <Path d="M3 9L4 2L10 7M14 7L20 2L21 9" fill={pet.color} />
        <Path d="M5 6L5.3 4.5L7.5 6.7M16.5 6.7L18.7 4.5L19 6" fill="#FFF3DC" />
      </>}
      {modern && pet.kind === 'dog' && <>
        <Ellipse cx={4} cy={9} rx={2.5} ry={5} fill={pet.color} />
        <Ellipse cx={20} cy={9} rx={2.5} ry={5} fill={pet.color} />
      </>}
      {modern && pet.kind === 'koala' && <>
        <Circle cx={4} cy={8} r={3.5} fill={pet.color} /><Circle cx={20} cy={8} r={3.5} fill={pet.color} />
        <Circle cx={4} cy={8} r={2} fill="#E6DEE1" /><Circle cx={20} cy={8} r={2} fill="#E6DEE1" />
      </>}
      {modern && pet.kind === 'frog' && <>
        <Circle cx={6.5} cy={7} r={3.2} fill={pet.color} /><Circle cx={17.5} cy={7} r={3.2} fill={pet.color} />
      </>}
      {modern && pet.kind === 'chick' && <Path d="M10 8Q8 3 12 5Q14 2 15 7" fill={pet.color} />}
      <Rect x={6} y={15} width={12} height={7} rx={3} fill={pet.color} />
      <Rect x={6.5} y={20} width={3.5} height={3} rx={1.5} fill={pet.color} />
      <Rect x={14} y={20} width={3.5} height={3} rx={1.5} fill={pet.color} />
      <Rect x={3} y={13} width={4} height={6} rx={2} fill={pet.color} />
      <Rect x={17} y={13} width={4} height={6} rx={2} fill={pet.color} />
      <Rect x={7.5} y={17} width={9} height={4} rx={2} fill="#FFF3DC" />
      <Rect x={3} y={7} width={18} height={11} rx={2.5} fill={pet.color} />
      {modern && pet.kind === 'fox' && <Path d="M3.5 12L9 14L12 17L15 14L20.5 12L20 16Q12 20 4 16Z" fill="#FFF3DC" />}
      {modern && pet.kind === 'penguin' && <>
        <Ellipse cx={8} cy={12.5} rx={4} ry={4.5} fill="#FFF3DC" /><Ellipse cx={16} cy={12.5} rx={4} ry={4.5} fill="#FFF3DC" />
      </>}
      {modern && pet.kind === 'panda' && <>
        <Ellipse cx={5.7} cy={12} rx={1.6} ry={2.5} fill="#75818B" /><Ellipse cx={18.3} cy={12} rx={1.6} ry={2.5} fill="#75818B" />
      </>}
      <Ellipse cx={6.5} cy={15} rx={1.5} ry={0.6} fill="#D47773" />
      <Ellipse cx={17.5} cy={15} rx={1.5} ry={0.6} fill="#D47773" />
      {modern && pet.kind === 'cat' && <Path d="M3 13L5 13.5M3 15L5 14.5M19 13.5L21 13M19 14.5L21 15" stroke="#75554A" strokeWidth={0.45} />}
      <CompanionFace mood={mood} sleeping={sleeping} />
      {(pet.kind === 'chick' || pet.kind === 'penguin') && <Path d="M11 13.8H13L12 14.8Z" fill="#C97922" />}
      {modern && pet.kind === 'koala' && <Ellipse cx={12} cy={13.5} rx={1} ry={1.3} fill="#59616C" />}
      {modern && pet.kind === 'dog' && <Path d="M11 13.6H13L12 14.6Z" fill="#6B554C" />}
    </Svg>
  );
}

import React from 'react';
import { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { CompanionMood } from '../utils/readingCompanion';

export default function CompanionFace({ mood, sleeping = false }: { mood: CompanionMood; sleeping?: boolean }) {
  if (sleeping) return <G stroke="#302D39" strokeWidth={0.8} fill="none" strokeLinecap="round">
    <Path d="M6.5 12.5Q8 14 9.5 12.5M14.5 12.5Q16 14 17.5 12.5" />
    <Ellipse cx={12} cy={15.7} rx={0.7} ry={0.9} />
    <Path d="M18 4H21L18 7H21M15 2H17L15 4H17" />
  </G>;
  return (
    <G stroke="#302D39" strokeWidth={0.75} strokeLinecap="round" strokeLinejoin="round">
      {mood === 'curious' && <>
        <Path d="M6.3 10.3Q7.6 9.4 9 10M15 10.7L17.8 10.7" fill="none" />
        <Ellipse cx={8} cy={12.4} rx={1.2} ry={1.5} fill="#302D39" stroke="none" />
        <Circle cx={16} cy={12.6} r={1} fill="#302D39" stroke="none" />
        <Ellipse cx={12} cy={15.7} rx={0.85} ry={1} fill="#302D39" stroke="none" />
      </>}
      {mood === 'sleepy' && <>
        <Path d="M6.5 11.5L9 12M15 12L17.5 11.5M6.5 13Q7.8 14 9 13M15 13Q16.2 14 17.5 13M10.5 16Q12 15 13.5 16" fill="none" />
      </>}
      {mood === 'hopeful' && <>
        <Path d="M6.5 10.7Q8 10.7 9 9.7M15 9.7Q16 10.7 17.5 10.7" fill="none" />
        <Ellipse cx={8} cy={12.5} rx={1.4} ry={1.8} fill="#302D39" stroke="none" />
        <Ellipse cx={16} cy={12.5} rx={1.4} ry={1.8} fill="#302D39" stroke="none" />
        <Circle cx={7.7} cy={11.8} r={0.55} fill="#FFF" stroke="none" />
        <Circle cx={15.7} cy={11.8} r={0.55} fill="#FFF" stroke="none" />
        <Path d="M10.7 15.5Q12 16.7 13.3 15.5" fill="none" />
      </>}
      {mood === 'happy' && <>
        <Path d="M6.5 10.6Q8 10 9.5 10.6M14.5 10.6Q16 10 17.5 10.6" fill="none" />
        <Ellipse cx={8} cy={12.6} rx={0.9} ry={1.2} fill="#302D39" stroke="none" />
        <Ellipse cx={16} cy={12.6} rx={0.9} ry={1.2} fill="#302D39" stroke="none" />
        <Path d="M9.5 15Q12 18 14.5 15" fill="none" />
      </>}
      {mood === 'joyful' && <>
        <Path d="M6.3 12.8Q8 9.5 9.7 12.8M14.3 12.8Q16 9.5 17.7 12.8" fill="none" strokeWidth={1.1} />
        <Path d="M9.5 14.8Q12 15.4 14.5 14.8Q14 18 12 18Q10 18 9.5 14.8Z" fill="#302D39" stroke="none" />
        <Path d="M10.7 17Q12 16.1 13.3 17Q12 18 10.7 17" fill="#E99596" stroke="none" />
      </>}
    </G>
  );
}

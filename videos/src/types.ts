// Shared types for Remotion compositions, camera rig, and kinetic callouts.

export interface CameraKeyframe {
  startFrame: number;
  durationInFrames: number;
  anchorX: number; // 0% to 100%
  anchorY: number; // 0% to 100%
  zoom: number; // 1.0x to 2.5x
}

export interface CalloutMetadata {
  x: number; // percentage 0-100%
  y: number; // percentage 0-100%
  label: string;
  sublabel?: string;
  badge?: string;
  keyboardShortcut?: string;
  width?: number;
  height?: number;
}

export interface VideoChapter {
  id: string;
  chapterNumber: number;
  category: string;
  title: string;
  subtitle: string;
  startFrame: number;
  durationInFrames: number;
  cameraKeyframe: CameraKeyframe;
  callout?: CalloutMetadata;
  targetSelector: string;
  presetId?: string;
  keyTakeaway: string;
}

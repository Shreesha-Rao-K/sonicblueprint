declare module "remotion" {
  export interface VideoConfig {
    fps: number;
    width: number;
    height: number;
    durationInFrames: number;
    id: string;
  }

  export function useCurrentFrame(): number;
  export function useVideoConfig(): VideoConfig;
  export function staticFile(filePath: string): string;

  export interface SpringConfig {
    damping?: number | undefined;
    mass?: number | undefined;
    stiffness?: number | undefined;
    overshootClamping?: boolean | undefined;
  }

  export function spring(options: {
    frame: number;
    fps: number;
    config?: SpringConfig | undefined;
    durationInFrames?: number | undefined;
    delay?: number | undefined;
  }): number;

  export interface InterpolateOptions {
    extrapolateLeft?: "clamp" | "extend" | "identity" | undefined;
    extrapolateRight?: "clamp" | "extend" | "identity" | undefined;
    easing?: ((t: number) => number) | undefined;
  }

  export function interpolate(
    input: number,
    inputRange: readonly number[],
    outputRange: readonly number[],
    options?: InterpolateOptions | undefined
  ): number;

  export const Composition: import("react").FC<{
    id: string;
    component: import("react").ComponentType<Record<string, unknown>>;
    durationInFrames: number;
    fps: number;
    width: number;
    height: number;
    defaultProps?: Record<string, unknown> | undefined;
  }>;

  export const Folder: import("react").FC<{
    name: string;
    children?: import("react").ReactNode | undefined;
  }>;

  export const Sequence: import("react").FC<{
    from?: number | undefined;
    durationInFrames?: number | undefined;
    name?: string | undefined;
    style?: import("react").CSSProperties | undefined;
    children?: import("react").ReactNode | undefined;
  }>;

  export const AbsoluteFill: import("react").FC<{
    style?: import("react").CSSProperties | undefined;
    className?: string | undefined;
    children?: import("react").ReactNode | undefined;
  }>;

  export const Audio: import("react").FC<{
    src: string;
    startFrom?: number | undefined;
    endAt?: number | undefined;
    volume?: number | ((frame: number) => number) | undefined;
    playbackRate?: number | undefined;
  }>;

  export const Video: import("react").FC<{
    src: string;
    startFrom?: number | undefined;
    endAt?: number | undefined;
    volume?: number | ((frame: number) => number) | undefined;
    playbackRate?: number | undefined;
    style?: import("react").CSSProperties | undefined;
  }>;

  export function registerRoot(component: import("react").ComponentType<Record<string, unknown>>): void;
}

declare module "@remotion/cli/config" {
  export namespace Config {
    export function setVideoImageFormat(format: "jpeg" | "png"): void;
    export function setCodec(codec: "h264" | "h265" | "vp8" | "vp9" | "prores"): void;
    export function setQuality(quality: number): void;
    export function setCrf(crf: number): void;
    export function setPixelFormat(format: "yuv420p" | "yuv422p" | "yuv444p"): void;
    export function setChromiumOpenGlRenderer(renderer: "angle" | "egl" | "swiftshader" | "swangle"): void;
    export function setConcurrency(concurrency: number): void;
    export function setOverwriteOutput(overwrite: boolean): void;
    export function overrideWebpackConfig(fn: (currentConfiguration: unknown) => unknown): void;
  }
}

declare module "@remotion/bundler" {
  export function bundle(options: {
    entryPoint: string;
    webpackOverride?: ((currentConfiguration: unknown) => unknown) | undefined;
  }): Promise<string>;
}

declare module "@remotion/renderer" {
  export function selectComposition(options: {
    serveUrl: string;
    id: string;
  }): Promise<Record<string, unknown>>;

  export function renderMedia(options: {
    composition: Record<string, unknown>;
    serveUrl: string;
    codec?: "h264" | "h265" | "vp8" | "vp9" | undefined;
    outputLocation: string;
    concurrency?: number | undefined;
    frameRange?: [number, number] | undefined;
    onProgress?: ((data: { progress: number }) => void) | undefined;
  }): Promise<void>;

  export function renderStill(options: {
    composition: Record<string, unknown>;
    serveUrl: string;
    output: string;
    frame: number;
    imageFormat?: "jpeg" | "png" | undefined;
    jpegQuality?: number | undefined;
  }): Promise<void>;
}

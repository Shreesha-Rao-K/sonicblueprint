import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setQuality(85);
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
Config.setChromiumOpenGlRenderer("angle");
Config.setConcurrency(4);
Config.setOverwriteOutput(true);

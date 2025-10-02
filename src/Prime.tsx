/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type ChangeEvent,
} from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Loader,
  AlertCircle,
} from "lucide-react";

// Custom hook: useThrottle
const useThrottle = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  const timeoutRef = useRef<number | null>(null);
  const lastRanRef = useRef<number>(0);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRanRef.current >= delay) {
        func(...args);
        lastRanRef.current = now;
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          func(...args);
          lastRanRef.current = Date.now();
        }, delay - (now - lastRanRef.current));
      }
    },
    [func, delay]
  );
};

// Custom hook: useDebounce
const useDebounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  const timeoutRef = useRef<number | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => func(...args), delay);
    },
    [func, delay]
  );
};

type VideoState = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

const Prime = () => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Core State
  const [videoState, setVideoState] = useState<VideoState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("videoVolume");
    return saved ? Number(saved) : 100;
  });
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UI State
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  // Settings State
  const [playbackRate, setPlaybackRate] = useState(() => {
    const saved = localStorage.getItem("playbackRate");
    return saved ? Number(saved) : 1;
  });

  // Derived state
  const isPlaying = videoState === "playing";
  const hasEnded = videoState === "ended";
  const isLoading = videoState === "loading";
  const hasError = videoState === "error";
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  const debouncedCheckMobile = useDebounce(checkMobile, 150);

  useEffect(() => {
    checkMobile();
    window.addEventListener("resize", debouncedCheckMobile);
    return () => window.removeEventListener("resize", debouncedCheckMobile);
  }, [debouncedCheckMobile]);
  // Format time helper
  const formatTime = useCallback((time: number): string => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  // Play/Pause with error handling
  const togglePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused || video.ended) {
        setVideoState("loading");
        await video.play();
        setVideoState("playing");
        if (video.ended) setVideoState("ended");
      } else {
        video.pause();
        setVideoState("paused");
      }
    } catch (err) {
      console.error("Playback error:", err);
      setVideoState("error");
      setErrorMessage("Failed to play video. Please try again.");
    }
  }, []);

  // Volume control with persistence
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const newMuted = !video.muted;
    video.muted = newMuted;
    setIsMuted(newMuted);
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume / 100;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    localStorage.setItem("videoVolume", String(newVolume));
  }, []);

  // Restart video
  const restartVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    setProgress(0);
    setVideoState("loading");

    try {
      await video.play();
      setVideoState("playing");
    } catch (err) {
      console.error("Restart error:", err);
      setVideoState("error");
    }
  }, []);

  // Skip time
  const skipTime = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video || !duration) return;

      video.currentTime = Math.max(
        0,
        Math.min(video.currentTime + seconds, duration)
      );
    },
    [duration]
  );

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  // Playback rate with persistence
  const changePlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
    localStorage.setItem("playbackRate", String(rate));
  }, []);

  // Progress update with RAF
  const updateProgress = useCallback(() => {
    const video = videoRef.current;
    if (!video || !duration) {
      rafRef.current = requestAnimationFrame(updateProgress);
      return;
    }

    setProgress((video.currentTime / duration) * 100);

    // Update buffered
    if (video.buffered.length > 0) {
      try {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / duration) * 100);
      } catch (e) {
        // Buffered ranges can throw if not ready
        console.debug("Buffered ranges not ready:", e);
      }
    }

    rafRef.current = requestAnimationFrame(updateProgress);
  }, [duration]);

  // Start/stop RAF updates
  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(updateProgress);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, updateProgress]);

  // Video event handlers
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    setDuration(video.duration);
    video.volume = volume / 100;
    video.playbackRate = playbackRate;
    setVideoState("idle");
  }, [volume, playbackRate]);

  const handleWaiting = useCallback(() => {
    setVideoState("loading");
  }, []);

  const handleCanPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!video.paused) {
      setVideoState("playing");
    }
  }, []);

  const handleError = useCallback(() => {
    setVideoState("error");
    setErrorMessage("Video failed to load. Please check your connection.");
  }, []);

  // Seek with progress bar
  const handleSeek = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video || !duration) return;

      const percent = Number(e.target.value);
      const time = (percent / 100) * duration;
      video.currentTime = time;
      setProgress(percent);

      if (hasEnded && time < duration) {
        setVideoState("paused");
      }
    },
    [duration, hasEnded]
  );

  const handleMouseMove = useThrottle(
    (e: React.MouseEvent<HTMLInputElement>) => {
      if (!duration) return;

      const rect = (e.target as HTMLInputElement).getBoundingClientRect();
      const percent = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      const time = percent * duration;

      if (time >= 0 && time <= duration) {
        setHoverTime(time);
      }
    },
    50
  );

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }

    setShowControls(true);

    if (isPlaying && !isMobile && !showSettings) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        if (!isHovering) {
          setShowControls(false);
        }
      }, 3000);
    }
  }, [isPlaying, isMobile, showSettings, isHovering]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlayPause();
          break;
        case "KeyM":
          e.preventDefault();
          toggleMute();
          break;
        case "KeyR":
          e.preventDefault();
          restartVideo();
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipTime(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          skipTime(5);
          break;
        case "ArrowUp":
          e.preventDefault();
          handleVolumeChange(Math.min(100, volume + 10));
          break;
        case "ArrowDown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 10));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlayPause,
    toggleMute,
    restartVideo,
    toggleFullscreen,
    skipTime,
    volume,
    handleVolumeChange,
  ]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Close settings on outside click
  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        showSettings &&
        !(e.target as Element).closest("[data-settings-menu]")
      ) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => document.removeEventListener("click", handleClickOutside);
  }, [showSettings]);

  // Current time calculation
  const currentTime = videoRef.current?.currentTime || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-2 sm:p-4 md:p-6">
      <div
        ref={containerRef}
        className="relative w-full max-w-6xl bg-black rounded-lg sm:rounded-xl md:rounded-2xl overflow-hidden shadow-2xl"
        onMouseMove={resetControlsTimeout}
        onMouseEnter={() => {
          setIsHovering(true);
          setShowControls(true);
        }}
        onMouseLeave={() => {
          setIsHovering(false);
          if (isPlaying && !isMobile) {
            setShowControls(false);
          }
        }}
        onTouchStart={() => setShowControls(true)}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          src="https://www.w3schools.com/html/mov_bbb.mp4"
          muted={isMuted}
          playsInline
          preload="metadata"
          className="w-full h-auto cursor-pointer"
          onClick={togglePlayPause}
          onPlay={() => setVideoState("playing")}
          onPause={() => setVideoState("paused")}
          onEnded={() => setVideoState("ended")}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onError={handleError}
          aria-label="Video player"
        />

        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
            <Loader
              className="animate-spin text-white"
              size={isMobile ? 40 : 60}
            />
          </div>
        )}

        {/* Error Message */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-4">
            <div className="text-center">
              <AlertCircle
                className="text-red-500 mx-auto mb-4"
                size={isMobile ? 48 : 64}
              />
              <p className="text-white text-sm sm:text-base md:text-lg mb-4">
                {errorMessage}
              </p>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setVideoState("idle");
                  videoRef.current?.load();
                }}
                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Center Play/Replay Button */}
        {!isLoading && !hasError && (
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${
              !isPlaying || hasEnded ? "opacity-100" : "opacity-0"
            }`}
          >
            <button
              onClick={hasEnded ? restartVideo : togglePlayPause}
              aria-label={hasEnded ? "Replay video" : "Play video"}
              className="
                bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold 
                px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 rounded-full shadow-2xl
                hover:from-red-500 hover:to-red-400 active:scale-95 transition-all duration-300
                flex items-center gap-2 sm:gap-3 pointer-events-auto
                transform hover:scale-105 text-sm sm:text-base md:text-lg
              "
            >
              {hasEnded ? (
                <RotateCcw size={isMobile ? 20 : 28} />
              ) : (
                <Play size={isMobile ? 20 : 28} fill="white" />
              )}
              <span>{hasEnded ? "Replay" : "Play Video"}</span>
            </button>
          </div>
        )}

        {/* Controls Overlay */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent px-2 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 transition-all duration-300 ${
            showControls || isMobile
              ? "translate-y-0 opacity-100"
              : "translate-y-full opacity-0"
          }`}
        >
          {/* Progress Bar Container */}
          <div className="relative w-full mb-3 sm:mb-4 md:mb-6 group/progress">
            {/* Buffered Progress */}
            <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 sm:h-1 bg-gray-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gray-600/80 transition-all duration-300"
                style={{ width: `${buffered}%` }}
              />
            </div>

            {/* Progress Track */}
            <div className="absolute top-1/2 -translate-y-1/2 w-full h-1 sm:h-1 bg-transparent rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-red-500 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Seekbar */}
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress}
              onChange={handleSeek}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverTime(null)}
              aria-label="Video progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="relative w-full h-6 sm:h-8 bg-transparent appearance-none cursor-pointer z-10
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:sm:w-4
                [&::-webkit-slider-thumb]:sm:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-red-500
                [&::-webkit-slider-thumb]:shadow-lg
                [&::-webkit-slider-thumb]:opacity-0
                [&::-webkit-slider-thumb]:transition-opacity
                [&::-webkit-slider-thumb]:group-hover/progress:opacity-100
                [&::-webkit-slider-thumb]:active:scale-125
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:sm:w-4
                [&::-moz-range-thumb]:sm:h-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-red-500
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:shadow-lg
                [&::-moz-range-thumb]:opacity-0
                [&::-moz-range-thumb]:transition-opacity
                [&::-moz-range-thumb]:group-hover/progress:opacity-100"
            />

            {/* Hover Time Tooltip */}
            {hoverTime !== null && !isMobile && (
              <div
                className="absolute -top-12 bg-black/95 border border-gray-700 rounded-md overflow-hidden shadow-xl pointer-events-none px-2 py-1"
                style={{
                  left: `${(hoverTime / duration) * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="text-white text-xs font-semibold whitespace-nowrap">
                  {formatTime(hoverTime)}
                </div>
              </div>
            )}
          </div>

          {/* Control Buttons - Mobile Optimized */}
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {/* Left Controls */}
            <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
              {/* Play/Pause  */}
              <button
                onClick={togglePlayPause}
                aria-label={isPlaying ? "Pause" : "Play"}
                className="text-white hover:text-red-500 transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-full"
              >
                {isPlaying ? (
                  <Pause size={isMobile ? 20 : 28} />
                ) : (
                  <Play size={isMobile ? 20 : 28} />
                )}
              </button>

              {!isMobile && (
                // Skip Btns
                <>
                  <button
                    onClick={() => skipTime(-5)}
                    aria-label="Rewind 5 seconds"
                    className="text-white hover:text-red-500 transition-colors p-2 hover:bg-white/10 rounded-full"
                  >
                    <SkipBack size={22} />
                  </button>

                  <button
                    onClick={() => skipTime(5)}
                    aria-label="Forward 5 seconds"
                    className="text-white hover:text-red-500 transition-colors p-2 hover:bg-white/10 rounded-full"
                  >
                    <SkipForward size={22} />
                  </button>
                </>
              )}
              {/* restart Btn */}
              <button
                onClick={restartVideo}
                aria-label="Restart video"
                className="text-white hover:text-red-500 transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-full"
              >
                <RotateCcw size={isMobile ? 18 : 22} />
              </button>

              {/* Volume Control */}
              <div
                className="flex items-center gap-1 sm:gap-2 relative"
                onMouseEnter={() => !isMobile && setShowVolumeSlider(true)}
                onMouseLeave={() => !isMobile && setShowVolumeSlider(false)}
              >
                <button
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  className="text-white hover:text-red-500 transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-full"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX size={isMobile ? 18 : 24} />
                  ) : (
                    <Volume2 size={isMobile ? 18 : 24} />
                  )}
                </button>

                {!isMobile && (
                  <div
                    className={`transition-all duration-300 overflow-hidden ${
                      showVolumeSlider
                        ? "w-16 sm:w-20 opacity-100"
                        : "w-0 opacity-0"
                    }`}
                  >
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : volume}
                      onChange={(e) =>
                        handleVolumeChange(Number(e.target.value))
                      }
                      aria-label="Volume"
                      className="w-full accent-red-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Time Display */}
              <div className="text-white text-xs sm:text-sm font-mono ml-1 sm:ml-2 hidden sm:block">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1 sm:gap-2 md:gap-3 relative">
              {/* Settings */}
              <div className="relative" data-settings-menu>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSettings(!showSettings);
                  }}
                  aria-label="Settings"
                  aria-expanded={showSettings}
                  className="text-white hover:text-red-500 transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-full"
                >
                  <Settings size={isMobile ? 18 : 24} />
                </button>

                {/* Settings Menu */}
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/98 border border-gray-700 rounded-lg shadow-2xl p-2 sm:p-3 min-w-[140px] sm:min-w-[160px] backdrop-blur-sm">
                    <div className="text-white text-xs sm:text-sm font-semibold mb-2 px-1">
                      Playback Speed
                    </div>
                    <div className="space-y-1">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => changePlaybackRate(rate)}
                          className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm transition-colors ${
                            playbackRate === rate
                              ? "bg-red-600 text-white"
                              : "text-gray-300 hover:bg-gray-800"
                          }`}
                        >
                          {rate === 1 ? "Normal" : `${rate}x`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
                className="text-white hover:text-red-500 transition-colors p-1.5 sm:p-2 hover:bg-white/10 rounded-full"
              >
                {isFullscreen ? (
                  <Minimize size={isMobile ? 18 : 24} />
                ) : (
                  <Maximize size={isMobile ? 18 : 24} />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Time Display */}
          {isMobile && (
            <div className="text-white text-xs font-mono text-center mt-2 opacity-75">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help (Desktop Only) */}
      {!isMobile && (
        <div className="fixed bottom-4 right-4 bg-black/90 text-white text-xs rounded-lg p-3 backdrop-blur-sm border border-gray-700 max-w-xs opacity-0 hover:opacity-100 transition-opacity">
          <div className="font-semibold mb-2">Keyboard Shortcuts</div>
          <div className="space-y-1 text-gray-300">
            <div>
              <kbd className="bg-gray-800 px-1.5 py-0.5 rounded">Space</kbd>{" "}
              Play/Pause
            </div>
            <div>
              <kbd className="bg-gray-800 px-1.5 py-0.5 rounded">M</kbd> Mute
            </div>
            <div>
              <kbd className="bg-gray-800 px-1.5 py-0.5 rounded">F</kbd>{" "}
              Fullscreen
            </div>
            <div>
              <kbd className="bg-gray-800 px-1.5 py-0.5 rounded">←/→</kbd> Skip
              5s
            </div>
            <div>
              <kbd className="bg-gray-800 px-1.5 py-0.5 rounded">↑/↓</kbd>{" "}
              Volume
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Prime;

import { useRef, useEffect, useState } from "react";
type VideoState = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

const VideoPlayer = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [coutn, setCoutn] = useState(0);
  const [videoState, setVideoState] = useState<VideoState>("idle");
  console.log("🚀 ~ videoState:", videoState);
  const isPlaying = videoState === "playing";
  const isIdle = videoState === "idle";
  const hasEnded = videoState === "ended";
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      let proto = videoRef.current;
      let level = 0;
      while (proto) {
        console.log(
          `Prototype level ${level}:`,
          Object.getOwnPropertyNames(proto)
        );
        proto = Object.getPrototypeOf(proto);
        level++;
      }
    }
  }, []); // runs once after the component mounts

  const togglePlayPause = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) {
        await video.play();
        setVideoState("playing");
      } else {
        video.pause();
        setVideoState("paused");
      }
    } catch (err) {
      setVideoState("error");

      console.error("Playback error:", err);
    }
  };
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePause = () => {
      if (!video.ended) {
        setCoutn(5); // manual pause
        setVideoState("paused");
      }
    };

    const handleEnded = () => {
      setVideoState("ended");
      setCoutn(0); // reset count when video ends
    };

    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        src="https://www.w3schools.com/html/mov_bbb.mp4"
        onClick={togglePlayPause}
        width={400}
      />

      <div className="flex justify-center items-center ">
        <h4>{coutn}</h4>
        <h1>
          {" "}
          {isIdle && "Click to Play"}
          {videoState === "loading" && "Loading..."}
          {isPlaying && "Playing"}
          {videoState === "paused" && "Paused"}
          {hasEnded && "Ended - Click to Replay"}
          {videoState === "error" && "Playback Error"}
        </h1>
      </div>
    </>
  );
};

export default VideoPlayer;

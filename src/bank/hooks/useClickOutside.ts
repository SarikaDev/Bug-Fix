import { useEffect, useRef, type RefObject } from "react";

export type ClickOrTouchEvent = MouseEvent | TouchEvent;

interface UseClickOutsideOptions {
  onMouseLeave?: () => void;
  onMouseEnter?: () => void;
}

const useClickOutside = <T extends HTMLElement>(
  ref: RefObject<T | null>,
  handlerFn?: (event?: ClickOrTouchEvent) => void,
  options?: UseClickOutsideOptions
) => {
  const handlerRef = useRef(handlerFn);
  const optionsRef = useRef(options);

  // Keep refs updated
  useEffect(() => {
    handlerRef.current = handlerFn;
    optionsRef.current = options;
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const clickListener = (event: ClickOrTouchEvent) => {
      if (node.contains(event.target as Node)) return;
      handlerRef.current?.(event);
    };

    const mouseLeaveListener = () => optionsRef.current?.onMouseLeave?.();
    const mouseEnterListener = () => optionsRef.current?.onMouseEnter?.();

    document.addEventListener("mousedown", clickListener);
    document.addEventListener("touchstart", clickListener);

    if (optionsRef.current?.onMouseLeave)
      node.addEventListener("mouseleave", mouseLeaveListener);
    if (optionsRef.current?.onMouseEnter)
      node.addEventListener("mouseenter", mouseEnterListener);

    return () => {
      document.removeEventListener("mousedown", clickListener);
      document.removeEventListener("touchstart", clickListener);
      node.removeEventListener("mouseleave", mouseLeaveListener);
      node.removeEventListener("mouseenter", mouseEnterListener);
    };
  }, [ref]); // Only re-run if ref changes
};

export default useClickOutside;

import { useCallback, useEffect, useRef } from 'react';

interface UseArrowKeyMovementOptions {
  enabled: boolean;
  onMove: (deltaX: number, deltaY: number) => void;
  baseSpeed?: number;
  maxSpeed?: number;
  acceleration?: number;
  stepInterval?: number;
}

/**
 * Hook to handle arrow key movement with acceleration
 * 
 * @param enabled - Whether arrow key movement is enabled
 * @param onMove - Callback function called with deltaX and deltaY for each movement step
 * @param baseSpeed - Initial movement speed in pixels per step (default: 1)
 * @param maxSpeed - Maximum movement speed in pixels per step (default: 20)
 * @param acceleration - Speed increase per step when key is held (default: 0.5)
 * @param stepInterval - Interval between movement steps in milliseconds (default: 16, ~60fps)
 */
export function useArrowKeyMovement({
  enabled,
  onMove,
  baseSpeed = 1,
  maxSpeed = 20,
  acceleration = 0.5,
  stepInterval = 16,
}: UseArrowKeyMovementOptions) {
  const pressedKeys = useRef<Set<string>>(new Set());
  const currentSpeed = useRef<number>(baseSpeed);
  const intervalRef = useRef<number | null>(null);

  // Use refs to store latest values to avoid recreating callbacks
  const baseSpeedRef = useRef(baseSpeed);
  const maxSpeedRef = useRef(maxSpeed);
  const accelerationRef = useRef(acceleration);
  const stepIntervalRef = useRef(stepInterval);
  const onMoveRef = useRef(onMove);

  // Update refs when values change
  baseSpeedRef.current = baseSpeed;
  maxSpeedRef.current = maxSpeed;
  accelerationRef.current = acceleration;
  stepIntervalRef.current = stepInterval;
  onMoveRef.current = onMove;

  const getDirection = useCallback((): { deltaX: number; deltaY: number } => {
    let deltaX = 0;
    let deltaY = 0;

    if (pressedKeys.current.has('ArrowLeft')) deltaX -= 1;
    if (pressedKeys.current.has('ArrowRight')) deltaX += 1;
    if (pressedKeys.current.has('ArrowUp')) deltaY -= 1;
    if (pressedKeys.current.has('ArrowDown')) deltaY += 1;

    return { deltaX, deltaY };
  }, []);

  const performMovement = useCallback(() => {
    const direction = getDirection();

    if (direction.deltaX === 0 && direction.deltaY === 0) {
      // No keys pressed, reset speed
      currentSpeed.current = baseSpeedRef.current;
      return;
    }

    // Normalize diagonal movement to maintain consistent speed
    const magnitude = Math.sqrt(direction.deltaX ** 2 + direction.deltaY ** 2);
    const normalizedX = direction.deltaX / magnitude;
    const normalizedY = direction.deltaY / magnitude;

    // Calculate movement with current speed
    const moveX = normalizedX * currentSpeed.current;
    const moveY = normalizedY * currentSpeed.current;

    // Apply movement using latest onMove
    onMoveRef.current(moveX, moveY);

    // Accelerate for next step using latest values
    currentSpeed.current = Math.min(
      currentSpeed.current + accelerationRef.current,
      maxSpeedRef.current
    );
  }, [getDirection]);

  useEffect(() => {
    if (!enabled) {
      // Clear any running interval and reset state
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      pressedKeys.current.clear();
      currentSpeed.current = baseSpeedRef.current;
      return;
    }

    // If keys are already pressed when effect runs, restart the interval
    if (pressedKeys.current.size > 0 && intervalRef.current === null) {
      currentSpeed.current = baseSpeedRef.current;
      performMovement(); // Immediate first movement
      intervalRef.current = window.setInterval(performMovement, stepIntervalRef.current);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Only handle arrow keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();

        if (!pressedKeys.current.has(e.key)) {
          pressedKeys.current.add(e.key);

          // Start movement interval if not already running
          if (intervalRef.current === null) {
            currentSpeed.current = baseSpeedRef.current;
            performMovement(); // Immediate first movement
            intervalRef.current = window.setInterval(performMovement, stepIntervalRef.current);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        pressedKeys.current.delete(e.key);

        // Stop interval if no keys are pressed
        if (pressedKeys.current.size === 0) {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          currentSpeed.current = baseSpeedRef.current;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, performMovement]);
}


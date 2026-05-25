import React, { useEffect, useRef, useCallback, useState } from 'react';

export type CharacterState = 'idle' | 'looking' | 'avoiding' | 'sad' | 'peeking';

interface AnimatedCharactersProps {
  characterStates: {
    purple: CharacterState;
    black: CharacterState;
    orange: CharacterState;
    yellow: CharacterState;
  };
  isError?: boolean;
}

const AnimatedCharacters: React.FC<AnimatedCharactersProps> = ({
  characterStates,
  isError = false,
}) => {
  const sceneRef = useRef<HTMLDivElement>(null);
  const pupilsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const eyesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const [isShaking, setIsShaking] = useState(false);
  const [blinkingEyes, setBlinkingEyes] = useState<Set<string>>(new Set());

  // 注册瞳孔和眼睛元素
  const registerPupil = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) pupilsRef.current.set(id, el);
    else pupilsRef.current.delete(id);
  }, []);

  const registerEye = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) eyesRef.current.set(id, el);
    else eyesRef.current.delete(id);
  }, []);

  // 鼠标跟随逻辑
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!sceneRef.current) return;

      const sceneRect = sceneRef.current.getBoundingClientRect();
      const mouseX = e.clientX - sceneRect.left;
      const mouseY = e.clientY - sceneRect.top;

      // 更新所有瞳孔位置
      pupilsRef.current.forEach((pupil, id) => {
        const eye = pupil.parentElement;
        if (!eye) return;

        const eyeRect = eye.getBoundingClientRect();
        const eyeCenterX = eyeRect.left - sceneRect.left + eyeRect.width / 2;
        const eyeCenterY = eyeRect.top - sceneRect.top + eyeRect.height / 2;

        const angle = Math.atan2(mouseY - eyeCenterY, mouseX - eyeCenterX);
        const distance = Math.min(3, Math.hypot(mouseX - eyeCenterX, mouseY - eyeCenterY) / 10);

        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        pupil.style.transform = `translate(${x}px, ${y}px)`;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // 随机眨眼
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      const purpleLeft = Math.random() > 0.5;
      const blackLeft = Math.random() > 0.5;

      setBlinkingEyes((prev) => {
        const newSet = new Set(prev);
        if (purpleLeft) newSet.add('purple-eye-l');
        else newSet.add('purple-eye-r');
        if (blackLeft) newSet.add('black-eye-l');
        else newSet.add('black-eye-r');
        return newSet;
      });

      setTimeout(() => {
        setBlinkingEyes((prev) => {
          const newSet = new Set(prev);
          newSet.delete('purple-eye-l');
          newSet.delete('purple-eye-r');
          newSet.delete('black-eye-l');
          newSet.delete('black-eye-r');
          return newSet;
        });
      }, 200);
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(blinkInterval);
  }, []);

  // 错误时的摇头动画
  useEffect(() => {
    if (isError) {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 800);
    }
  }, [isError]);

  // 根据状态计算眼睛位置
  const getEyePosition = (character: string, state: CharacterState) => {
    const positions: Record<string, Record<CharacterState, { left: number; top: number; gap: number }>> = {
      purple: {
        idle: { left: 45, top: 40, gap: 28 },
        looking: { left: 55, top: 40, gap: 8 },
        avoiding: { left: 25, top: 40, gap: 48 },
        sad: { left: 45, top: 50, gap: 28 },
        peeking: { left: 35, top: 35, gap: 28 },
      },
      black: {
        idle: { left: 26, top: 32, gap: 20 },
        looking: { left: 34, top: 32, gap: 4 },
        avoiding: { left: 14, top: 32, gap: 36 },
        sad: { left: 26, top: 40, gap: 20 },
        peeking: { left: 20, top: 28, gap: 20 },
      },
      orange: {
        idle: { left: 82, top: 90, gap: 28 },
        looking: { left: 92, top: 90, gap: 8 },
        avoiding: { left: 62, top: 90, gap: 48 },
        sad: { left: 82, top: 100, gap: 28 },
        peeking: { left: 72, top: 85, gap: 28 },
      },
      yellow: {
        idle: { left: 52, top: 40, gap: 20 },
        looking: { left: 60, top: 40, gap: 4 },
        avoiding: { left: 40, top: 40, gap: 36 },
        sad: { left: 52, top: 48, gap: 20 },
        peeking: { left: 46, top: 36, gap: 20 },
      },
    };
    return positions[character]?.[state] || positions[character]?.idle;
  };

  const purplePos = getEyePosition('purple', characterStates.purple);
  const blackPos = getEyePosition('black', characterStates.black);
  const orangePos = getEyePosition('orange', characterStates.orange);
  const yellowPos = getEyePosition('yellow', characterStates.yellow);

  return (
    <div className="characters-scene" ref={sceneRef}>
      {/* 紫色矩形角色 */}
      <div className="character char-purple" id="char-purple">
        <div
          className={`eyes ${isShaking ? 'shake-head' : ''}`}
          id="purple-eyes"
          ref={(el) => registerEye('purple-eyes', el)}
          style={{ left: purplePos.left, top: purplePos.top, gap: purplePos.gap }}
        >
          <div
            className={`eyeball ${blinkingEyes.has('purple-eye-l') ? 'blinking' : ''}`}
            id="purple-eye-l"
            style={{ width: 18, height: 18 }}
          >
            <div
              className="pupil"
              id="purple-pupil-l"
              ref={(el) => registerPupil('purple-pupil-l', el)}
              style={{ width: 7, height: 7 }}
            />
          </div>
          <div
            className={`eyeball ${blinkingEyes.has('purple-eye-r') ? 'blinking' : ''}`}
            id="purple-eye-r"
            style={{ width: 18, height: 18 }}
          >
            <div
              className="pupil"
              id="purple-pupil-r"
              ref={(el) => registerPupil('purple-pupil-r', el)}
              style={{ width: 7, height: 7 }}
            />
          </div>
        </div>
      </div>

      {/* 黑色矩形角色 */}
      <div className="character char-black" id="char-black">
        <div
          className={`eyes ${isShaking ? 'shake-head' : ''}`}
          id="black-eyes"
          ref={(el) => registerEye('black-eyes', el)}
          style={{ left: blackPos.left, top: blackPos.top, gap: blackPos.gap }}
        >
          <div
            className={`eyeball ${blinkingEyes.has('black-eye-l') ? 'blinking' : ''}`}
            id="black-eye-l"
            style={{ width: 16, height: 16 }}
          >
            <div
              className="pupil"
              id="black-pupil-l"
              ref={(el) => registerPupil('black-pupil-l', el)}
              style={{ width: 6, height: 6 }}
            />
          </div>
          <div
            className={`eyeball ${blinkingEyes.has('black-eye-r') ? 'blinking' : ''}`}
            id="black-eye-r"
            style={{ width: 16, height: 16 }}
          >
            <div
              className="pupil"
              id="black-pupil-r"
              ref={(el) => registerPupil('black-pupil-r', el)}
              style={{ width: 6, height: 6 }}
            />
          </div>
        </div>
      </div>

      {/* 橙色半圆角色 */}
      <div className="character char-orange" id="char-orange">
        <div
          className={`eyes ${isShaking ? 'shake-head' : ''}`}
          id="orange-eyes"
          ref={(el) => registerEye('orange-eyes', el)}
          style={{ left: orangePos.left, top: orangePos.top, gap: orangePos.gap }}
        >
          <div className="bare-pupil" id="orange-pupil-l" ref={(el) => registerPupil('orange-pupil-l', el)} />
          <div className="bare-pupil" id="orange-pupil-r" ref={(el) => registerPupil('orange-pupil-r', el)} />
        </div>
        <div className={`orange-mouth ${characterStates.orange === 'sad' ? 'visible' : ''} ${isShaking ? 'shake-head' : ''}`} id="orange-mouth" style={{ left: 90, top: 120 }} />
      </div>

      {/* 黄色圆角角色 */}
      <div className="character char-yellow" id="char-yellow">
        <div
          className={`eyes ${isShaking ? 'shake-head' : ''}`}
          id="yellow-eyes"
          ref={(el) => registerEye('yellow-eyes', el)}
          style={{ left: yellowPos.left, top: yellowPos.top, gap: yellowPos.gap }}
        >
          <div className="bare-pupil" id="yellow-pupil-l" ref={(el) => registerPupil('yellow-pupil-l', el)} />
          <div className="bare-pupil" id="yellow-pupil-r" ref={(el) => registerPupil('yellow-pupil-r', el)} />
        </div>
        <div className={`yellow-mouth ${isShaking ? 'shake-head' : ''}`} id="yellow-mouth" style={{ left: 40, top: 88 }} />
      </div>
    </div>
  );
};

export default AnimatedCharacters;

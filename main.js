const main = function () {
  const css = `
:root {
  --color-black: black;
  --color-playarea: hsl(235deg 15% 67%);
}

.play-area {
  position: fixed;
  top: calc(var(--top) * 1px);
  left: calc(var(--left) * 1px);
  width: calc(var(--width) * 1px);
  height: calc(var(--height) * 1px);
  background-color: var(--color-playarea);
  outline: 2px dashed black;
  pointer-events: none;
  transition: opacity 1s ease;
}

.ball {
  position: fixed;
  left: calc(var(--left)* 1px);
  top: calc(var(--top)* 1px);
  width: calc(var(--size)* 1px);
  height: calc(var(--size)* 1px);
  background-color: var(--color-black);
  border-radius: 50%;
  will-change: transform;
  transition: transform 0.1s linear, opacity 1s ease;
  z-index: 1001;
}

.paddle {
  position: fixed;
  left: calc(var(--left)* 1px);
  top: calc(var(--top)* 1px);
  width: calc(var(--width)* 1px);
  height: calc(var(--height)* 1px);
  background-color: var(--color-black);
  z-index: 1002;
  transition: transform 0.05s linear, opacity 1s ease;
}

.transparent {
  opacity: 0;
}

.faded {
  opacity: 0.3;
  transition: opacity 0.5s ease, background-color 0.5s ease;
}
  `;
  const style = document.createElement("style");
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);

  const BALL_SIZE = 50;
  const TICK_TIME = 100;
  const BASE_SPEED = 10;
  const STOP_AFTER_THIS_MANY_TICKS = 150;
  const FADE_IN_TIME = 1000;

  const mainElt = document.querySelector("div[role='main']");
  const grid = mainElt.querySelector("div[role='grid']");
  const topPlayArea = grid
    .querySelector("div[role='row'][aria-hidden='false']")
    .getBoundingClientRect();
  const bottomPlayArea = grid.children[1].getBoundingClientRect();
  const LEFT = Math.min(topPlayArea.left, bottomPlayArea.left);
  const TOP = topPlayArea.top;
  const RIGHT = Math.max(topPlayArea.right, bottomPlayArea.right);
  const BOTTOM = Math.max(bottomPlayArea.bottom, window.innerHeight - 25) - 25;
  const WIDTH = RIGHT - LEFT;
  const HEIGHT = BOTTOM - TOP;
  let paddleLeft = WIDTH / 2 - 50;
  let ballLeft = WIDTH / 2;
  let ballTop = HEIGHT - 100;
  const direction = { x: 1, y: 1 };

  function createElt(id, style = {}, classList = []) {
    document.querySelector(`#${id}`)?.remove();
    const elt = document.createElement("div");
    elt.id = id;
    elt.classList.add(...classList);
    Object.keys(style).forEach((key) => {
      elt.style.setProperty(key, style[key]);
    });
    document.body.appendChild(elt);
    return elt;
  }

  const playArea = createElt(
    "_playArea",
    { "--top": TOP, "--left": LEFT, "--width": WIDTH, "--height": HEIGHT },
    ["play-area", "transparent"]
  );

  const ball = createElt(
    "_ball",
    { "--top": TOP, "--left": LEFT, "--size": BALL_SIZE },
    ["ball", "transparent"]
  );

  const paddle = createElt(
    "_paddle",
    { "--top": BOTTOM - 22, "--left": LEFT, "--width": 100, "--height": 20 },
    ["paddle", "transparent"]
  );

  const clamp = (min, max, value) => Math.min(Math.max(min, value), max);

  function translate(elt, x, y) {
    elt.style.transform = `translate(${x}px, ${y}px)`;
  }

  const getIntersectionState = ({ oldBall, newBall, elt }) => {
    const intersectsFromLeft = (ball, bounds) =>
      ball.right >= bounds.left && ball.left <= bounds.left;

    const intersectsFromRight = (ball, bounds) =>
      ball.left <= bounds.right && ball.right >= bounds.right;

    const intersectsFromAbove = (ball, bounds) =>
      ball.bottom >= bounds.top && ball.top <= bounds.top;

    const intersectsFromBelow = (ball, bounds) =>
      ball.top <= bounds.bottom && ball.bottom >= bounds.bottom;

    const doesNotIntersect =
      newBall.bottom < elt.top ||
      newBall.top > elt.bottom ||
      newBall.right < elt.left ||
      newBall.left > elt.right;

    if (doesNotIntersect) {
      return { intersects: false };
    }

    const justIntersected = (checkIntersect) => {
      return checkIntersect(newBall, elt) && !checkIntersect(oldBall, elt);
    };

    const intersectsFrom = {
      left: justIntersected(intersectsFromLeft),
      right: justIntersected(intersectsFromRight),
      above: justIntersected(intersectsFromAbove),
      below: justIntersected(intersectsFromBelow),
    };
    return { intersects: true, intersectsFrom };
  };

  function wrappedIntervalLoop(fn, label) {
    return () => {
      try {
        fn();
      } catch (e) {
        console.log(`${label} ERROR: ${e}`);
      }
    };
  }

  function paddleLoop() {
    const keysPressed = { ArrowLeft: false, ArrowRight: false };
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        keysPressed[e.key] = true;
      }
    });
    document.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        keysPressed[e.key] = false;
      }
    });

    function loop() {
      let shouldTranslate = false;
      if (keysPressed.ArrowLeft) {
        paddleLeft = clamp(0, WIDTH - 100, paddleLeft - 2);
        shouldTranslate = true;
      }
      if (keysPressed.ArrowRight) {
        paddleLeft = clamp(0, WIDTH - 100, paddleLeft + 2);
        shouldTranslate = true;
      }
      if (shouldTranslate) {
        translate(paddle, paddleLeft, 0);
      }
    }

    return wrappedIntervalLoop(loop, "PADDLE");
  }

  function mainLoop() {
    const translatedBounds = (obj) => {
      const bounds = obj.getBoundingClientRect();
      return {
        left: bounds.left - LEFT,
        right: bounds.right - LEFT,
        top: bounds.top - TOP,
        bottom: bounds.bottom - TOP,
      };
    };

    const ensureToLeftOf = (ballBox, left) => {
      ballBox.left = left - BALL_SIZE;
      ballBox.right = left;
    };
    const ensureToRightOf = (ballBox, right) => {
      ballBox.right = right + BALL_SIZE;
      ballBox.left = right;
    };
    const ensureAbove = (ballBox, top) => {
      ballBox.top = top - BALL_SIZE;
      ballBox.bottom = top;
    };
    const ensureBelow = (ballBox, bottom) => {
      ballBox.bottom = bottom + BALL_SIZE;
      ballBox.top = bottom;
    };

    function loop() {
      let nextLeft = ballLeft + BASE_SPEED * direction.x;
      let nextTop = ballTop + BASE_SPEED * direction.y;
      let hasCollided = false;
      const movingLeft = direction.x < 0;
      const movingRight = direction.x > 0;
      const movingUp = direction.y < 0;
      const movingDown = direction.y > 0;

      if (nextLeft < 0) {
        direction.x *= -1;
        nextLeft = 0;
        hasCollided = true;
      } else if (nextLeft + BALL_SIZE > WIDTH) {
        direction.x *= -1;
        hasCollided = true;
        // nextLeft = WIDTH - BALL_SIZE;
      }
      if (nextTop < 0) {
        direction.y *= -1;
        nextTop = 0;
        hasCollided = true;
      } else if (nextTop > HEIGHT - BALL_SIZE) {
        direction.y *= -1;
        hasCollided = true;
        // nextTop = HEIGHT - BALL_SIZE;
      }

      const oldBall = {
        left: ballLeft,
        right: ballLeft + BALL_SIZE,
        top: ballTop,
        bottom: ballTop + BALL_SIZE,
      };
      const newBall = {
        left: nextLeft,
        right: nextLeft + BALL_SIZE,
        top: nextTop,
        bottom: nextTop + BALL_SIZE,
      };

      document
        .querySelector("div[role='main']")
        .querySelectorAll("div[role='button']")
        .forEach((event) => {
          if (event.dataset.intersected) {
            return;
          }

          const eventBounds = translatedBounds(event);
          const { intersects, intersectsFrom } = getIntersectionState({
            oldBall,
            newBall,
            elt: eventBounds,
          });

          if (intersects) {
            console.log(`INTERSECTION DETECTED: ${event.textContent}`);
            event.classList.add("faded");
            event.dataset.intersected = "true";
            // I think we might want to handle X and Y separately here? unsure.
            if (hasCollided) {
              console.log("SKIPPING A COLLISION");
              return;
            }
            console.log(`NEXT BOX: ${JSON.stringify(newBall)}`);
            console.log(`EVENT BOUNDS: ${JSON.stringify(eventBounds)}`);
            console.log(`INTERSECTIONS: ${JSON.stringify(intersectsFrom)}`);
            console.log("--------------");

            if (movingRight && intersectsFrom.left) {
              direction.x *= -1;
              ensureToLeftOf(newBall, eventBounds.left);
              hasCollided = true;
            } else if (movingLeft && intersectsFrom.right) {
              direction.x *= -1;
              ensureToRightOf(newBall, eventBounds.right);
              hasCollided = true;
            }

            if (movingDown && intersectsFrom.above) {
              direction.y *= -1;
              ensureAbove(newBall, eventBounds.top);
              hasCollided = true;
            } else if (movingUp && intersectsFrom.below) {
              direction.y *= -1;
              ensureBelow(newBall, eventBounds.bottom);
              hasCollided = true;
            }

            if (!hasCollided) {
              console.warn(`NO COLLISION DETECTED for ${event.textContent}`);
              direction.x *= -1;
              direction.y *= -1;
              hasCollided = true;
            }
          }
        });

      translate(ball, newBall.left, newBall.top);
      ballLeft = newBall.left;
      ballTop = newBall.top;
    }

    return wrappedIntervalLoop(loop, "GAME");
  }

  let mainInterval;
  let paddleInterval;
  function applyInitialTranslations() {
    translate(ball, ballLeft, ballTop);
    translate(paddle, paddleLeft, 0);
  }
  applyInitialTranslations();

  const stopGame = setTimeout(() => {
    console.log("STOPPING");
    clearInterval(mainInterval);
    clearInterval(paddleInterval);
  }, STOP_AFTER_THIS_MANY_TICKS * TICK_TIME);

  const setup = setTimeout(() => {
    ball.classList.remove("transparent");
    playArea.classList.remove("transparent");
    paddle.classList.remove("transparent");
  }, 1);

  const startGame = setTimeout(() => {
    mainInterval = setInterval(mainLoop(), TICK_TIME);
    paddleInterval = setInterval(paddleLoop(), 1000 / 60);
  }, FADE_IN_TIME + 1);
};

function resetEvents() {
  const EVENTS = document
    .querySelector("div[role='main']")
    .querySelectorAll("div[role='button']");
  EVENTS.forEach((event) => {
    event.classList.remove("faded");
    event.dataset.intersected = "";
  });
}

resetEvents();
main();

"use strict";

function createElt({
  id = null,
  style = {},
  classList = [],
  kind = "div",
  parent = null,
  textContent = null,
  onSubmit = null,
}) {
  if (onSubmit) {
    const form = document.createElement("form");
    form.onsubmit = (e) => {
      e.preventDefault();
      onSubmit();
    };
    parent.appendChild(form);
    parent = form;
  }
  const elt = document.createElement(kind);
  if (id) {
    document.querySelector(`#${id}`)?.remove();
    elt.id = id;
  }
  if (textContent) {
    elt.textContent = textContent;
  }
  elt.classList.add(...classList);
  Object.keys(style).forEach((key) => {
    elt.style.setProperty(key, style[key]);
  });
  parent = parent || document.body;
  parent.appendChild(elt);
  return elt;
}

const getEvents = () => {
  return document
    .querySelector("div[role='main']")
    .querySelectorAll("div[role='button']");
};

const selectByTitle = (title, count) => {
  const events = getEvents();
  const selected = Array.from(events).filter((event) =>
    event.textContent.includes(title)
  );
  return selected.slice(0, count);
};

const findButtonToClick = (candidates, text, getText) => {
  const matches = Array.from(candidates).filter((candidate) =>
    getText(candidate).toLowerCase().includes(text)
  );
  if (matches.length === 1) {
    return matches[0];
  } else if (matches.length > 1) {
    console.warn(`TOO MANY MATCHES for ${text}`);
    return false;
  } else {
    console.warn(`NO MATCHES for ${text}`);
    return false;
  }
};

const findButtonByText = (candidates, text) => {
  return findButtonToClick(
    candidates,
    text,
    (candidate) => candidate.textContent
  );
};

const findButtonByAriaLabel = (candidates, text) => {
  return findButtonToClick(candidates, text, (candidate) =>
    candidate.getAttribute("aria-label")
  );
};

const maybeDeclineRecurringEvent = (dialog) => {
  console.log("CONSIDER DECLINE RECURRING");
  const okButton = findButtonByText(
    dialog.querySelectorAll("div[role='button']"),
    "ok"
  );
  if (okButton) {
    okButton.click();
    return true;
  } else {
    return false;
  }
};

const closeEvent = (buttons) => {
  const closeButton = findButtonByAriaLabel(buttons, "close");
  if (closeButton) {
    closeButton.click();
    return true;
  } else {
    return false;
  }
};

const maybeDeclineBaseEvent = (dialog) => {
  const buttons = dialog.querySelectorAll("button");
  const declineButton = findButtonByText(buttons, "no");
  if (!declineButton) {
    console.log("NO DECLINE BUTTON - TRYING TO CLOSE");
    return closeEvent(buttons);
  }
  if (declineButton.getAttribute("aria-label").includes("selected")) {
    console.log("DECLINE ALREADY SELECTED - TRYING TO CLOSE");
    return closeEvent(buttons);
  } else {
    declineButton.click();
    return true;
  }
};

const detectDialogAddition = (mutations, observer) => {
  console.log("DETECTING DIALOG ADDITION");
  for (const mutation of mutations) {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const roleDialog = node.querySelector("div[role='dialog']");
          let success = false;
          if (roleDialog?.textContent.includes("RSVP to recurring event")) {
            success = maybeDeclineRecurringEvent(roleDialog);
          } else if (roleDialog) {
            success = maybeDeclineBaseEvent(roleDialog);
          }
          if (success) {
            console.debug("CLICK SUCCESS");
          } else {
            console.debug("CLICK FAILURE");
          }
        }
      });
    }
  }
};

function waitForDialogsToClear() {
  let dialogCount = 0;
  let hasSeenADialog = false;
  return new Promise((resolve) => {
    const observer = new MutationObserver((mutations, observer) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (
              node.nodeType === 1 &&
              node.querySelector("div[role='dialog']")
            ) {
              dialogCount++;
              hasSeenADialog = true;
            }
          });
          mutation.removedNodes.forEach((node) => {
            if (
              node.nodeType === 1 &&
              node.querySelector("div[role='dialog']")
            ) {
              dialogCount--;
            }
          });
        }
        if (hasSeenADialog && dialogCount === 0) {
          observer.disconnect();
          resolve();
        }
      }
    });
    const observerConfig = { childList: true, subtree: true };
    observer.observe(document.body, observerConfig);
  });
}

const startDismissObserver = () => {
  const observer = new MutationObserver(detectDialogAddition);
  const observerConfig = { childList: true, subtree: true };
  observer.observe(document.body, observerConfig);
  return observer;
};

async function runTest(title) {
  const observer = startDismissObserver();
  const event = selectByTitle(title, 1)[0];
  event.click();
  await waitForDialogsToClear();
  observer.disconnect();
}

async function declineSomeEvents(count = 3) {
  const events = Array.from(getEvents());
  const observer = startDismissObserver();
  for (let i = 0; i < Math.min(count, events.length); i++) {
    events[i].click();
    await waitForDialogsToClear();
  }
  observer.disconnect();
}

const css = `
:root {
  --color-black: hsl(235deg 15% 15%);
  --color-grey: hsl(235deg 5% 35%);
  --color-grey-transparent: hsla(235deg 5% 35% / 0.7);
  --color-playarea: hsl(235deg 15% 67%);
  --color-borders: hsl(245deg 15% 70%);

  --hue-rotation: 0deg;
  --ball-background: hsl(0deg 20% 50%);
  --paddle-background: hsl(180deg 20% 50%);

  --google-blue: #1a73e8;
  --google-grey: rgb(95, 99, 104);
}

@keyframes revealClipPath {
  from {
    clip-path: polygon(-10% -10%, 110% -10%, 110% -10%, -10% -10%);
  }
  to {
    clip-path: polygon(-10% -10%, 110% -10%, 110% 110%, -10% 110%);
  }
}

@keyframes revealFromCenter {
  from {
    clip-path: polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%);
  }
  to {
    clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);
  }
}

.play-area {
  position: fixed;
  top: calc(var(--top) * 1px);
  left: calc(var(--left) * 1px);
  width: calc(var(--width) * 1px);
  height: calc(var(--height) * 1px);
  outline: 2px dashed var(--color-borders);
  pointer-events: none;
  transition: opacity 1.5s ease;
  animation: revealClipPath 1s ease both;
  will-change: transform, clip-path;
}


.no-collision-zone {
  position: fixed;
  height: calc(var(--height) * 1px);
  left: calc(var(--left) * 1px);
  width: calc(var(--width) * 1px);
  bottom: calc(var(--bottom) * 1px);
  border-top: 2px dashed var(--color-borders);
  animation: revealFromCenter 0.5s ease both;
  animation-delay: 0.25s;
  backdrop-filter: blur(6px);
  z-index: 999;
}

@keyframes slideInFromBottom {
  from {
    transform: translate(var(--translate-x), calc(var(--slide-in-y-amount) + var(--translate-y)));
  }
  to {
   transform: translate(var(--translate-x), calc(var(--translate-y)));
  }

}

.slide-in-from-bottom {
  animation: slideInFromBottom 0.75s ease-out both;
}

.ball {
  --slide-in-y-amount: 300px;
  position: fixed;
  left: calc(var(--left)* 1px);
  top: calc(var(--top)* 1px);
  width: calc(var(--size)* 1px);
  height: calc(var(--size)* 1px);
  background-color: var(--ball-background);
  border-radius: 50%; 
  will-change: transform;
  transition: opacity 1s ease;
  filter: hue-rotate(var(--hue-rotation));
  border: 2px solid var(--color-grey-transparent);
  box-sizing: border-box;
  z-index: 1001;
}

.hidden-ball {
  display: none;
  z-index: 1000;
  filter: blur(6px) hue-rotate(var(--hue-rotation));
  transition: opacity 1s ease, filter var(--transform-speed) ease, transform var(--transform-speed) ease;
}

@keyframes fading-trail {
  0% {
    opacity: 0.75;
    transform: scale(0.9);
    filter: blur(2px);
  }

  100% {
    opacity: 0;
    transform: scale(0.3);
    filter: blur(4px);
  }
}

.fading-trail {
  animation: fading-trail 1s ease-out both;
  display: revert;
}

.paddle {
  --hue-rotation: 0deg;
  --slide-in-y-amount: 200px;
  box-sizing: border-box;
  position: fixed;
  left: calc(var(--left)* 1px);
  top: calc(var(--top)* 1px);
  width: calc(var(--width)* 1px);
  height: calc(var(--height)* 1px);
  background-color: var(--paddle-background);
  border: 2px solid var(--color-grey-transparent);
  border-radius: 2px;
  filter: hue-rotate(var(--hue-rotation));
  z-index: 1002;
  transition: opacity 1s ease;
  transform-origin: bottom center;
}

.faded {
  opacity: 0.1;
  transition: opacity 0.5s ease, background-color 0.5s ease;
}

particle {
  border-radius: 2px;
  width: var(--width);
  height: var(--height);
  background-color: var(--color);
  position: fixed;
  filter: brightness(0.9) hue-rotate(var(--hue-rotation)) saturate(var(--saturation));
  z-index: 1000;
  pointer-events: none;
  will-change: transform, opacity;
  left: var(--left);
  top: var(--top);
  display: var(--display);
}

@fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.decline-events-modal {
  border-radius: 8px;
  font-family: "Google Sans", Roboto, Arial, sans-serif;
  font-size: 16px;
  font-weight: 500;
  border: 1px solid var(--color-grey-transparent);
  box-shadow: rgba(60, 64, 67, 0.3) 0px 1px 3px 0px, rgba(60, 64, 67, 0.15) 0px 4px 8px 3px;
  display: flex;
  align-items: stretch;
  min-width: 320px;
  min-height: 150px;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 12px 8px;
  background: white;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  margin: 4px 16px;
  z-index: 2000;

  animation: fade-in 0.5s ease both;
}

.decline-events-modal-choices {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}

.decline-events-choice {
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  padding: 4px 6px;
  font-family: "Google Sans", Roboto, Arial, sans-serif;
  font-weight: 500;
  cursor: pointer;
  background-color: transparent;
  transition: background-color 0.2s ease;
}

.decline-events-choice:hover {
  background-color: hsl(235deg 4% 82% / 0.7);
}

.decline-events-modal-close {
  background: none;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  transition: fill 0.2s ease;
  cursor: pointer;
}

.decline-events-modal-close:hover .x-icon{
  fill: black;
}

.decline-events-choice-trash {
  /* color: #f59f9f; */
  color: var(--google-blue);
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.decline-events-choice-keep {
  color: var(--google-grey);
}

.trash-can {
  display: flex;
}

.x-icon {
  fill: var(--google-grey);
  transition: fill 0.2s ease;
}

.trash-icon {
  fill: var(--google-blue);
}

@keyframes fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
`;

function createSvgIcon(parent, classList, paths) {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.classList.add(...classList);
  svg.setAttributeNS(null, "width", "20");
  svg.setAttributeNS(null, "height", "20");
  svg.setAttributeNS(null, "viewBox", "0 0 24 24");

  paths.forEach((d) => {
    const path = document.createElementNS(svgNS, "path");
    path.setAttributeNS(null, "d", d);
    svg.appendChild(path);
  });
  parent.appendChild(svg);
  return svg;
}

function createTrashCan(parent) {
  const paths = [
    "M15 4V3H9v1H4v2h1v13c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V6h1V4h-5zm2 15H7V6h10v13z",
    "M9 8h2v9H9zm4 0h2v9h-2z",
  ];
  return createSvgIcon(parent, ["trash-icon"], paths);
}

function createXIcon(parent) {
  const paths = [
    "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z",
  ];
  return createSvgIcon(parent, ["x-icon"], paths);
}

const injectCSS = () => {
  const style = document.createElement("style");
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
};

function createEventDeclineModal(titleText, declineEvents) {
  const modal = createElt({ classList: ["decline-events-modal"] });
  const dismiss = () => {
    modal.style.animation = "fade-out 0.5s ease";
    setTimeout(() => {
      modal.remove();
    }, 500);
  };

  const dismissAndClear = () => {
    destroyedEvents.clear();
    dismiss();
  };

  // declineEvents is async; this function waits for it to complete
  // and then calls dismiss
  const handleDecline = async () => {
    dismiss();
    await declineEvents();
  };

  const titleRow = createElt({
    kind: "div",
    parent: modal,
    style: {
      display: "flex",
      "justify-content": "space-between",
      "align-items": "center",
    },
  });
  const title = createElt({
    classList: ["decline-events-modal-title"],
    kind: "span",
    style: { "font-size": "16px" },
    parent: titleRow,
    textContent: titleText,
  });
  const XButton = createElt({
    classList: ["decline-events-modal-close"],
    kind: "button",
    parent: titleRow,
    onSubmit: dismissAndClear,
  });
  const X = createXIcon(XButton);
  const question = createElt({
    classList: ["decline-events-modal-question"],
    kind: "span",
    style: { "align-self": "center", "font-size": "20px" },
    parent: modal,
    textContent: "Actually decline your events?",
  });
  const choices = createElt({
    classList: ["decline-events-modal-choices"],
    parent: modal,
  });
  const noButton = createElt({
    classList: ["decline-events-choice", "decline-events-choice-keep"],
    kind: "button",
    parent: choices,
    textContent: "No, keep my meetings",
    onSubmit: dismissAndClear,
  });
  const yesButton = createElt({
    classList: ["decline-events-choice", "decline-events-choice-trash"],
    kind: "button",
    parent: choices,
    onSubmit: handleDecline,
  });
  const trashIcon = createElt({
    classList: ["trash-can"],
    kind: "div",
    parent: yesButton,
  });
  createTrashCan(trashIcon);
  const yesText = createElt({
    classList: ["decline-events-modal-yes-text"],
    kind: "span",
    parent: yesButton,
    textContent: "Yes, decline my meetings!",
  });
}

function makeModal(title) {
  injectCSS();
  createEventDeclineModal(title, () => {
    console.log("DECLINE EVENTS");
  });
}

const main = function () {
  injectCSS();

  const BALL_SIZE = 25;
  const RADIUS = BALL_SIZE / 2;
  const TICK_TIME = 50;
  const BASE_SPEED = 10;
  const PADDLE_SPEED = 12.5;
  const STOP_AFTER_THIS_MANY_TICKS = 2000;

  const mainElt = document.querySelector("div[role='main']");
  const grid = mainElt.querySelector("div[role='grid']");

  const bottomPlayArea = grid.children[1];
  const bottomPlayRect = bottomPlayArea.getBoundingClientRect();
  /* This only exists if there are all-day events on the calendar. */
  const topPlayArea = grid.querySelector(
    "div[role='row'][aria-hidden='false']"
  );

  const topPlayRect = topPlayArea?.getBoundingClientRect() || bottomPlayRect;

  const LEFT = Math.min(topPlayRect.left, bottomPlayRect.left);
  const TOP = topPlayRect.top;
  /* If there are all-day events there's an additional div at the top of the screen
  that we need to respect; an event can be *above* that but below top (and we should
    avoid shattering it) - and when we generate particles we should use this
    to cap the top of the particle area. */
  const NON_ALL_DAY_EVENT_TOP = topPlayArea ? topPlayRect.bottom - TOP : 0;
  const RIGHT = Math.max(topPlayRect.right, bottomPlayRect.right);
  const BOTTOM_OFFSET = 5;
  const SAFE_ZONE_HEIGHT = 150 - BOTTOM_OFFSET;
  const BOTTOM =
    Math.max(bottomPlayRect.bottom, window.innerHeight - BOTTOM_OFFSET) -
    BOTTOM_OFFSET;
  const WIDTH = RIGHT - LEFT;
  const HEIGHT = BOTTOM - TOP;
  const PADDLE_WIDTH = 100;
  const PADDLE_HEIGHT = 20;
  const HUE_PER_TICK = 360 / (10000 / TICK_TIME);
  const destroyedEvents = new Set();

  let RUN_GAME = false;
  const hueRotation = { ball: 0, paddle: 0 };
  let currentBall = {
    x: WIDTH / 2,
    y: HEIGHT - 100 + RADIUS,
    r: RADIUS,
  };
  let nextBall = { x: currentBall.x, y: currentBall.y, r: currentBall.r };
  const paddleRect = {
    left: WIDTH / 2 - PADDLE_WIDTH / 2,
    top: HEIGHT - 22,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    right: WIDTH / 2 + PADDLE_WIDTH / 2,
    bottom: HEIGHT - 22 + PADDLE_HEIGHT,
  };

  const getBallLeft = (ball) => ball.x - ball.r;
  const getBallRight = (ball) => ball.x + ball.r;
  const getBallTop = (ball) => ball.y - ball.r;
  const getBallBottom = (ball) => ball.y + ball.r;

  const playArea = createElt({
    id: "_playArea",
    style: {
      "--top": TOP,
      "--left": LEFT,
      "--width": WIDTH,
      "--height": HEIGHT,
    },
    classList: ["play-area"],
  });

  /* nroyalty: no more heightOffset hijinks? */
  const [noCollisionZone, noCollisionZoneTop] = (() => {
    let topForCalculations = BOTTOM - SAFE_ZONE_HEIGHT - TOP;
    const elt = createElt({
      id: "_noCollisionZone",
      style: {
        "--height": SAFE_ZONE_HEIGHT,
        "--left": LEFT,
        "--width": WIDTH,
        "--bottom": BOTTOM_OFFSET,
      },
      classList: ["no-collision-zone"],
    });
    return [elt, topForCalculations];
  })();

  const ballElement = createElt({
    id: "_ball",
    style: {
      "--top": TOP,
      "--left": LEFT,
      "--size": BALL_SIZE,
      "--transform-speed": `${TICK_TIME * 1.1}ms`,
    },
    classList: ["ball", "slide-in-from-bottom"],
  });

  const paddleElement = createElt({
    id: "_paddle",
    style: {
      "--top": TOP,
      "--left": LEFT,
      "--width": PADDLE_WIDTH,
      "--height": PADDLE_HEIGHT,
    },
    classList: ["paddle", "slide-in-from-bottom"],
  });

  const clamp = (min, max, value) => Math.min(Math.max(min, value), max);

  // nroyalty: make sure this handles things in the right order
  function addTransform(elt, transform, key) {
    const prefix = `data-transform-`;
    elt.setAttribute(prefix + key, transform);
    const transforms = [];
    for (const [k, v] of Object.entries(elt.dataset)) {
      if (k.startsWith("transform")) {
        transforms.push(v);
      }
    }
    elt.style.transform = transforms.join(" ");
  }

  function removeTransform(elt, key) {
    const prefix = `data-transform-`;
    elt.removeAttribute(prefix + key);
    const transforms = [];
    for (const [k, v] of Object.entries(elt.dataset)) {
      if (k.startsWith("transform")) {
        transforms.push(v);
      }
    }
    elt.style.transform = transforms.join(" ");
  }

  function translate(elt, x, y) {
    addTransform(elt, `translate(${x}px, ${y}px)`, "translate");
    elt.style.setProperty("--translate-x", x + "px");
    elt.style.setProperty("--translate-y", y + "px");
  }

  function translateBall(ball) {
    const left = getBallLeft(ball);
    const top = getBallTop(ball);
    translate(ballElement, left, top);
  }

  function translatePaddle() {
    translate(paddleElement, paddleRect.left, paddleRect.top);
  }

  function rotateForVector(elt, dx, dy) {
    // dy is negative because the y axis is inverted in the browser.
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) {
      angle += 360;
    }

    addTransform(elt, `rotate(${angle}deg)`, "rotate");
  }

  function getClosestPointToCircle(circle, rect) {
    const closestX = clamp(rect.left, rect.right, circle.x);
    const closestY = clamp(rect.top, rect.bottom, circle.y);
    return { x: closestX, y: closestY };
  }

  function getDistance(obj1, obj2) {
    const dx = obj1.x - obj2.x;
    const dy = obj1.y - obj2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function circleCollidesWithRect(circle, closestPoint) {
    const distance = getDistance(circle, closestPoint);
    return distance < circle.r;
  }

  function detectCircularCollision(ball, collisionRect) {
    const closestPoint = getClosestPointToCircle(ball, collisionRect);
    const collided = circleCollidesWithRect(ball, closestPoint);
    return collided;
  }

  const ticksToCollision = (center, side, direction) =>
    Math.abs((RADIUS - Math.abs(side - center)) / direction);

  const getTicksToCollision = (circle, rect, direction) => {
    const ticks = { x: Infinity, y: Infinity };
    const relevantSideX = direction.x > 0 ? rect.left : rect.right;
    const relevantSideY = direction.y > 0 ? rect.top : rect.bottom;
    const canCollideX =
      direction.x > 0 ? circle.x < rect.left : circle.x > rect.right;
    const canCollideY =
      direction.y > 0 ? circle.y < rect.top : circle.y > rect.bottom;
    [
      ["x", relevantSideX, direction.x, canCollideX],
      ["y", relevantSideY, direction.y, canCollideY],
    ].forEach(([axis, relevantSide, direction, canCollide]) => {
      ticks[axis] = canCollide
        ? ticksToCollision(circle[axis], relevantSide, direction)
        : Infinity;
    });
    return ticks;
  };

  function handleCollision(ball, collisionRect, direction, hasCollided) {
    const ticksToCollision = getTicksToCollision(
      ball,
      collisionRect,
      direction
    );

    const minTicks = Math.min(ticksToCollision.x, ticksToCollision.y);
    const tryBounce = {
      x: ticksToCollision.x !== Infinity,
      y: ticksToCollision.y !== Infinity,
    };

    // nroyalty: need to figure out if this needs to account for bouncing
    // on two different events and whether, in that case, we should bounce
    // off the "minor" axis of the second event if the first event only
    // triggers a bounce on the major axis
    let didCollide = false;
    if (tryBounce.x && !hasCollided.x) {
      hasCollided.x = true;
      ball.x -= minTicks * direction.x;
      direction.x *= -1;
      didCollide = true;
    }
    if (tryBounce.y && !hasCollided.y) {
      hasCollided.y = true;
      ball.y -= minTicks * direction.y;
      direction.y *= -1;
      didCollide = true;
    }
    return didCollide;
  }

  function handlePlayAreaCollision(ball, direction, hasCollided) {
    const left = getBallLeft(ball);
    const top = getBallTop(ball);
    const right = getBallRight(ball);
    const bottom = getBallBottom(ball);
    if (left < 0) {
      direction.x = Math.abs(direction.x);
      ball.x += Math.abs(left);
      hasCollided.x = true;
    } else if (right > WIDTH) {
      direction.x = -Math.abs(direction.x);
      ball.x -= right - WIDTH;
      hasCollided.x = true;
    }
    if (top < 0) {
      direction.y = Math.abs(direction.y);
      ball.y += Math.abs(top);
      hasCollided.y = true;
    } else if (bottom > HEIGHT) {
      direction.y = -Math.abs(direction.y);
      ball.y -= bottom - HEIGHT;
      hasCollided.y = true;
      return "game-over";
    }
    return "continue";
  }

  /* Reflecting off the center 3rd of the paddle just inverts the Y direction. */
  function handleCenterCollision(direction, hasCollided, tickId) {
    direction.y = -1 * Math.abs(direction.y);
    hasCollided.y = true;
  }

  const DO_REFLECTION_COLLISION = false;
  /* I spent a while trying to reflect the ball off the paddle but found it
   pretty wonky - you end up needing a ton of constraints to not send the ball
   at weird angles especially when it's colliding with, e.g., the right corner
   while moving to the right. I think using the reflection angle is ~fine. */
  function handleBounceAgainstCorner(
    reflectionVector,
    direction,
    hasCollided,
    tickId
  ) {
    reflectionVector = normalize(reflectionVector);
    let newDirection;
    if (DO_REFLECTION_COLLISION) {
      let normalizedDirection = normalize(direction);
      const dot = dotProduct(reflectionVector, normalizedDirection);
      const toSubtract = multiplyVector(reflectionVector, 2 * dot);
      newDirection = subtractVectors(normalizedDirection, toSubtract);
      console.log(`[${tickId}] OLD DIRECTION: ${JSON.stringify(direction)}`);
      console.log(
        `[${tickId}] REFLECTION VECTOR: ${JSON.stringify(reflectionVector)}`
      );
      newDirection = scaleVectorToRoot2(newDirection);
    } else {
      newDirection = scaleVectorToRoot2(reflectionVector);
    }
    console.log(`[${tickId}] NEW DIRECTION: ${JSON.stringify(newDirection)}`);
    direction.x = newDirection.x;
    direction.y = newDirection.y;
    hasCollided.x = true;
    hasCollided.y = true;
  }

  function updateForPaddleCollision(
    ball,
    paddleRect,
    direction,
    hasCollided,
    tickId
  ) {
    const leftThird = paddleRect.left + PADDLE_WIDTH / 3;
    const rightThird = paddleRect.left + (PADDLE_WIDTH / 3) * 2;
    if (ball.x < leftThird) {
      const distanceFromLeft = Math.max(0, ball.x - paddleRect.left);
      const scaledToPaddle = distanceFromLeft / (PADDLE_WIDTH / 3);
      const x = -8 * (1 - scaledToPaddle);
      const reflectionVector = { x, y: -8 };
      handleBounceAgainstCorner(
        reflectionVector,
        direction,
        hasCollided,
        tickId
      );
    } else if (ball.x > rightThird) {
      const distanceFromTheRight = Math.min(
        PADDLE_WIDTH / 3,
        ball.x - rightThird
      );
      const scaledToPaddle = distanceFromTheRight / (PADDLE_WIDTH / 3);
      const x = 8 * scaledToPaddle;
      const reflectionVector = { x, y: -8 };
      handleBounceAgainstCorner(
        reflectionVector,
        direction,
        hasCollided,
        tickId
      );
    } else {
      handleCenterCollision(direction, hasCollided, tickId);
    }
    if (direction.y > 0) {
      console.log(
        `[${tickId}] BUG? MOVING DOWN AFTER PADDLE COLLISION ${JSON.stringify(
          direction
        )}`
      );
      direction.y *= -1;
    }
  }

  const makeJitter = () => 0.9 + Math.random() * 0.2;

  function makeAddParticle() {
    const PARTICLE_COUNT = 300;
    let currentParticleIdx = 0;
    const makeParticle = (_, id) => {
      const elt = createElt({ classList: ["particle"], kind: "particle" });
      return [elt, null];
    };
    const particles = Array.from({ length: PARTICLE_COUNT }, makeParticle);

    const addParticle = ({
      x,
      y,
      width,
      height,
      vector,
      distance,
      rotation,
      color,
      hueRotation,
      duration,
      delay,
      easing,
    }) => {
      const [currentParticle, currentAnimation] = particles[currentParticleIdx];

      if (currentAnimation) {
        // nroyalty: do I need to briefly hide the particle here?
        currentAnimation.cancel();
      }

      [
        ["--width", `${width}px`],
        ["--height", `${height}px`],
        ["--color", color],
        ["--hue-rotation", hueRotation],
        ["--saturation", 1.2 + Math.random() * 0.5],
        ["--left", x + LEFT + "px"],
        ["--top", y + TOP + "px"],
        ["--display", "block"],
      ].forEach(([propertyName, propertyValue]) => {
        currentParticle.style.setProperty(propertyName, propertyValue);
      });

      const toX = vector.x * distance;
      const toY = vector.y * distance;
      const startingAnimation = { opacity: 1 };
      const endingAnimation = {
        transform: `translate(${toX}px, ${toY}px) rotate(${rotation})`,
        opacity: 0.35,
      };
      const animation = currentParticle.animate(
        [startingAnimation, endingAnimation],
        { duration, delay, easing }
      );
      animation.onfinish = () => {
        currentParticle.style.setProperty("--display", "none");
      };

      particles[currentParticleIdx] = [currentParticle, animation];
      currentParticleIdx = (currentParticleIdx + 1) % PARTICLE_COUNT;
    };

    return addParticle;
  }
  const addParticle = makeAddParticle();

  function addParticlesForEvent(event, bounds) {
    const computedStyle = window.getComputedStyle(event);
    const color = computedStyle.backgroundColor || "slategrey";
    const width = bounds.width;
    const top = Math.max(bounds.top, 0);
    const bottom = Math.min(bounds.bottom, noCollisionZoneTop);
    const height = bottom - top;

    let numberOfRows = 3;
    let numberOfColumns = 10;
    if (height / 5 > width) {
      numberOfRows = 4;
      numberOfColumns = 5;
    }

    const baseParticleWidth = width / numberOfColumns;
    const baseParticleHeight = height / numberOfRows;

    for (let y = 0; y < numberOfRows; y++) {
      for (let x = 0; x < numberOfColumns; x++) {
        const fromX = bounds.left + baseParticleWidth * x;
        const fromY = top + baseParticleHeight * y;
        const centerX = bounds.left + bounds.width / 2;
        const centerY = top + height / 2;
        const vector = normalize(
          subtractVectors({ x: fromX, y: fromY }, { x: centerX, y: centerY })
        );
        vector.x *= makeJitter();
        vector.y *= makeJitter();

        addParticle({
          x: fromX,
          y: fromY,
          width: baseParticleWidth * makeJitter(),
          height: baseParticleHeight * makeJitter(),
          vector,
          distance: Math.floor(Math.random() * 75 + 25),
          rotation: (Math.random() - 0.5) * 720 + "deg",
          color,
          hueRotation: (Math.random() - 0.5) * 30 + "deg",
          duration: 250 + Math.random() * 500,
          delay: Math.random() * 100,
          easing: "ease",
        });
      }
    }
  }

  function addParticlesForPaddleCollision(direction) {
    const computedStyle = window.getComputedStyle(paddleElement);
    const color = computedStyle.backgroundColor || "slategrey";
    for (let i = 0; i < 15; i++) {
      const vectorX = (Math.random() - 0.5) * 2 + direction.x * 0.5;
      const vector = normalize({
        x: vectorX,
        y: -1,
      });
      addParticle({
        x: nextBall.x + 25 * (Math.random() - 0.5),
        y: paddleRect.top,
        width: 6 * makeJitter(),
        height: 5 * makeJitter(),
        vector,
        distance: Math.random() * 25 + 50,
        rotation: (Math.random() - 0.5) * 720 + "deg",
        color,
        hueRotation: hueRotation.paddle + "deg",
        duration: 250 + Math.random() * 150,
        delay: Math.random() * 50,
        easing: "ease-out",
      });
    }
  }

  function magnitude(v) {
    return Math.sqrt(v.x * v.x + v.y * v.y);
  }

  function normalize(v) {
    const mag = magnitude(v);
    return { x: v.x / mag, y: v.y / mag };
  }

  function dotProduct(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y;
  }

  function truncateDigits(v, digits = 2) {
    const amount = Math.pow(10, digits);
    return Math.floor(v * amount) / amount;
  }
  function truncateVector(v, digits = 2) {
    return {
      x: truncateDigits(v.x, digits),
      y: truncateDigits(v.y, digits),
    };
  }

  function subtractVectors(v1, v2) {
    return { x: v1.x - v2.x, y: v1.y - v2.y };
  }

  function multiplyVector(v, scalar) {
    return { x: v.x * scalar, y: v.y * scalar };
  }

  function scaleVectorToRoot2(v) {
    const scaled = multiplyVector(normalize(v), Math.sqrt(2));
    return truncateVector(scaled, 2);
  }

  function makeScreenShake() {
    const duration = 250;
    let magnitude = 7.5;
    let startTime = null;
    const isShaking = false;

    function shake(currentTime) {
      [mainElt].forEach((target) => {
        if (!target) {
          return;
        }
        const elapsedTime = currentTime - startTime;
        const remainingTime = duration - elapsedTime;
        if (remainingTime > 0) {
          const randomX = (Math.random() - 0.5) * magnitude;
          const randomY = (Math.random() - 0.5) * magnitude;
          target.style.transform = `translate(${randomX}px, ${randomY}px)`;
          requestAnimationFrame(shake);
        } else {
          target.style.transform = "translate(0px, 0px)";
          magnitude = 5;
          isShaking = false;
        }
      });
    }

    function startOrContinueShaking() {
      startTime = performance.now();
      if (isShaking) {
        magnitude += 5;
      } else {
        requestAnimationFrame(shake);
      }
    }
    return startOrContinueShaking;
  }

  const screenShake = makeScreenShake();

  /* it'd be more convenient to move the paddle within a separate interval loop,
  but for animation smoothness i think we want to move it within the main 
  requestAnimationFrame loop. So here we just keep some state around how
  long the paddle has been pressed and we apply and reset that state every
  tick. */
  const [startPaddleListeners, stopPaddleListeners, getDirectionalPaddleDelta] =
    (() => {
      const directions = [
        ["left", "ArrowLeft"],
        ["right", "ArrowRight"],
      ];
      const intervals = {
        left: { pressedSince: null, past: 0 },
        right: { pressedSince: null, past: 0 },
      };
      const handleKeydown = (e) => {
        directions.forEach(([key, code]) => {
          if (e.code === code) {
            intervals[key].pressedSince = performance.now();
          }
        });
      };

      const handleKeyup = (e) => {
        const addInterval = (key) => {
          const pressedSince = intervals[key].pressedSince;
          if (pressedSince) {
            const interval = performance.now() - pressedSince;
            intervals[key].past += interval;
            intervals[key].pressedSince = null;
          }
        };

        directions.forEach(([key, code]) => {
          if (e.code === code) {
            addInterval(key);
          }
        });
      };

      const start = () => {
        document.addEventListener("keydown", handleKeydown);
        document.addEventListener("keyup", handleKeyup);
      };

      const stop = () => {
        document.removeEventListener("keydown", handleKeydown);
        document.removeEventListener("keyup", handleKeyup);
      };

      const getAndReset = (key, timestamp) => {
        let t = intervals[key].past;
        if (intervals[key].pressedSince) {
          t += timestamp - intervals[key].pressedSince;
          intervals[key].pressedSince = timestamp;
        }
        intervals[key].past = 0;
        return t;
      };

      const getDirectionalDelta = (timestamp) => {
        return getAndReset("right", timestamp) - getAndReset("left", timestamp);
      };
      return [start, stop, getDirectionalDelta];
    })();

  function incrementHueRotation(amount) {
    hueRotation.ball += amount.ball || 0;
    hueRotation.paddle += amount.paddle || 0;
    if (hueRotation.paddle > 360) {
      hueRotation.paddle = hueRotation.paddle % 360;
    }
    hueRotation.ball = hueRotation.ball % 360;

    ballElement.style.setProperty(
      "--hue-rotation",
      Math.floor(hueRotation.ball) + "deg"
    );
    paddleElement.style.setProperty(
      "--hue-rotation",
      Math.floor(hueRotation.paddle) + "deg"
    );
  }

  /* to avoid adding a new dom element every tick we use a little pool */
  function makeAddBallTrail() {
    const TRAIL_COUNT = 10;
    const makeTrail = () => {
      const id = Math.floor(Math.random() * 1000000);
      const elt = createElt({
        style: {
          "--top": TOP,
          "--left": LEFT,
          "--size": BALL_SIZE,
          "--transform-speed": `${TICK_TIME}ms`,
        },
        classList: ["ball", "hidden-ball"],
      });
      return [elt, null];
    };
    const trails = Array.from({ length: TRAIL_COUNT }, makeTrail);
    let trailIndex = 0;

    const addBallTrail = () => {
      const left = getBallLeft(currentBall);
      const top = getBallTop(currentBall);
      const [trail, oldAnimation] = trails[trailIndex];
      if (oldAnimation) {
        oldAnimation.cancel();
      }

      trail.style.setProperty("--top", TOP + top);
      trail.style.setProperty("--left", LEFT + left);
      trail.style.setProperty("--hue-rotation", hueRotation.ball + "deg");
      const animation = trail.animate(
        [
          {
            opacity: 0.75,
            transform: "scale(0.8)",
            display: "revert",
          },
          {
            opacity: 0.1,
            transform: "scale(0.3)",
            display: "revert",
          },
        ],
        { duration: 1000, easing: "ease", fill: "both" }
      );
      trails[trailIndex] = [trail, animation];

      trailIndex = (trailIndex + 1) % TRAIL_COUNT;
    };

    return addBallTrail;
  }
  const addBallTrail = makeAddBallTrail();

  const translatedBounds = (obj, isAllDay) => {
    const bounds = obj.getBoundingClientRect();
    let bottom = Math.min(bounds.bottom - TOP, noCollisionZoneTop);
    const upperBound = isAllDay ? 0 : NON_ALL_DAY_EVENT_TOP;

    if (bottom < upperBound) {
      return null;
    }

    let top = Math.max(bounds.top - TOP, upperBound);

    if (top > noCollisionZoneTop) {
      return null;
    }

    return {
      left: bounds.left - LEFT,
      right: bounds.right - LEFT,
      top: top,
      bottom: bottom,
      width: bounds.width,
      height: bounds.height,
    };
  };

  function determineIsAllDay(event) {
    /* I don't know of a great way to do this that isn't either fragile due to
    the dom structure, fragile due to relying on English, or involves some guesswork
    around the bounds of the all day dom element D:

    This seems to work surprisingly well and it's not a huge deal to get this wrong.
    */
    const inner = event.innerText.split("\n");
    return inner.length === 2;
  }

  function maybeCollideWithEvent(event, ball, direction, hasCollided, tickId) {
    if (event.dataset.intersected) {
      return;
    }

    const isAllDay = determineIsAllDay(event);
    const eventBounds = translatedBounds(event, isAllDay);
    if (eventBounds === null) {
      return;
    }
    const collided = detectCircularCollision(ball, eventBounds);
    if (collided) {
      console.log(`[${tickId}] COLLISION DETECTED: ${event.textContent}`);
      event.classList.add("faded");
      event.dataset.intersected = "true";
      addParticlesForEvent(event, eventBounds);
      screenShake();
      destroyedEvents.add(event);
      const bounced = handleCollision(
        ball,
        eventBounds,
        direction,
        hasCollided
      );
      console.log(`[${tickId}] BOUNCE? ${bounced}: ${event.textContent}`);
    }
  }

  function mainLoop({ makeGameOverModal, makeWonGameModal }) {
    const direction = { x: 1, y: 1 };
    const hasCollided = { x: false, y: false };
    let ticksUntilCanPaddleBounce = 0;
    let tickId = 0;
    let lastFrameTime = 0;
    let timeUntilNextBallTrail = 0;

    function applyDirectionDeltas(direction, timestamp, delta) {
      nextBall.x = currentBall.x + BASE_SPEED * direction.x * delta;
      nextBall.y = currentBall.y + BASE_SPEED * direction.y * delta;

      const paddleDelta = getDirectionalPaddleDelta(timestamp);
      const paddleMovement = (paddleDelta / TICK_TIME) * PADDLE_SPEED;
      paddleRect.left = clamp(
        0,
        WIDTH - PADDLE_WIDTH,
        paddleRect.left + paddleMovement
      );
      paddleRect.right = paddleRect.left + PADDLE_WIDTH;
    }

    function resetTickState(delta) {
      ticksUntilCanPaddleBounce = Math.max(0, ticksUntilCanPaddleBounce - 1);
      tickId = Math.floor(Math.random() * 1000000);
      hasCollided.x = false;
      hasCollided.y = false;
      timeUntilNextBallTrail += delta;
    }

    function handlePaddleCollision() {
      if (ticksUntilCanPaddleBounce > 0) {
        return false;
      }

      const collidesWithPaddle = detectCircularCollision(nextBall, paddleRect);
      if (!collidesWithPaddle) {
        return false;
      }

      if (direction.y < 0) {
        console.log(`[${tickId}] COLLIDED WITH PADDLE WHILE MOVING UP`);
      }
      ticksUntilCanPaddleBounce = 10;
      console.log(`[${tickId}] PADDLE COLLISION DETECTED`);
      updateForPaddleCollision(
        nextBall,
        paddleRect,
        direction,
        hasCollided,
        tickId
      );
      return true;
    }

    const easeOut = (t, factor = 2) => 1 - Math.pow(1 - t, factor);
    const easeIn = (t, factor = 2) => Math.pow(t, factor);

    /* We need to do some of our scaling and easing by hand because we rely
    on translating positions in CSS to move that and *don't*
    want any easing to be applied to that translation. */
    function makeTweenUpDown({
      timeUp,
      timeDown,
      valueUp,
      valueDown,
      applyValue,
      cleanUp,
    }) {
      let beginTime = null;
      const totalTime = timeUp + timeDown;

      const beginTween = (now) => {
        beginTime = now;
      };

      const maybeTween = (currentTime) => {
        if (beginTime === null) {
          return;
        }
        const timeElapsed = currentTime - beginTime;
        if (timeElapsed > totalTime) {
          cleanUp();
          beginTime = null;
          return;
        }
        if (timeElapsed <= timeUp) {
          const t = timeElapsed / timeUp;
          applyValue(valueUp(t));
        } else {
          const t = (timeElapsed - timeUp) / timeDown;
          applyValue(valueDown(t));
        }
      };

      return [beginTween, maybeTween];
    }

    const BALL_MAX_SCALE = 0.3;
    const BALL_SCALE_UP_DURATION = 100;
    const BALL_SCALE_DOWN_DURATION = 3 * BALL_SCALE_UP_DURATION;
    const [beginScaleBall, maybeScaleBall] = makeTweenUpDown({
      timeUp: BALL_SCALE_UP_DURATION,
      timeDown: BALL_SCALE_DOWN_DURATION,
      valueUp: (t) => 1 + easeOut(t) * BALL_MAX_SCALE,
      valueDown: (t) => 1 + (1 - t) * BALL_MAX_SCALE,
      applyValue: (value) => {
        const x = truncateDigits(value, 2);
        addTransform(ballElement, `scale(${x})`, "scale");
      },
      cleanUp: () => {
        removeTransform(ballElement, "scale");
      },
    });

    function applyCollisionVisualEffects(currentTime) {
      const collisionCount = (hasCollided.x ? 1 : 0) + (hasCollided.y ? 1 : 0);

      if (collisionCount > 0) {
        incrementHueRotation({ ball: 15 * collisionCount });
        beginScaleBall(currentTime);
      }

      maybeScaleBall(currentTime);
    }

    const PADDLE_MAX_Y_SCALE = -0.15;
    const PADDLE_MAX_X_SCALE = 0.05;
    const [beginTweenPaddle, maybeTweenPaddle] = makeTweenUpDown({
      timeUp: BALL_SCALE_UP_DURATION,
      timeDown: BALL_SCALE_DOWN_DURATION,
      valueUp: (t) => {
        const x = 1 + easeOut(t) * PADDLE_MAX_X_SCALE;
        const y = 1 + easeOut(t) * PADDLE_MAX_Y_SCALE;
        return { x, y };
      },
      valueDown: (t) => {
        const x = 1 + PADDLE_MAX_X_SCALE - easeIn(t) * PADDLE_MAX_X_SCALE;
        const y = 1 + PADDLE_MAX_Y_SCALE - easeIn(t) * PADDLE_MAX_Y_SCALE;
        return { x, y };
      },
      applyValue: (value) => {
        const x = truncateDigits(value.x, 2);
        const y = truncateDigits(value.y, 2);
        addTransform(paddleElement, `scale(${x}, ${y})`, "scale");
      },
      cleanUp: () => {
        removeTransform(paddleElement, "scale");
      },
    });

    function applyPaddleCollisionEffects(collidedWithPaddle, currentTime) {
      if (collidedWithPaddle) {
        beginTweenPaddle(currentTime);
        addParticlesForPaddleCollision(direction);
      }
      maybeTweenPaddle(currentTime);
    }

    function maybeAddBallTrail() {
      if (timeUntilNextBallTrail > 1) {
        addBallTrail();
        timeUntilNextBallTrail -= 1;
      }
    }

    function handleCleanup() {
      stopPaddleListeners();
    }

    function loop(timestamp) {
      try {
        if (!RUN_GAME) {
          handleCleanup();
          return;
        }

        const timeElapsed = timestamp - lastFrameTime;
        const delta = truncateDigits(timeElapsed / TICK_TIME, 1);
        lastFrameTime = timestamp;

        resetTickState(delta);
        applyDirectionDeltas(direction, timestamp, delta);

        const whatToDo = handlePlayAreaCollision(
          nextBall,
          direction,
          hasCollided
        );

        if (whatToDo === "game-over") {
          makeGameOverModal();
          handleCleanup();
          return;
        }

        const collidedWithPaddle = handlePaddleCollision();
        getEvents().forEach((event) => {
          maybeCollideWithEvent(
            event,
            nextBall,
            direction,
            hasCollided,
            tickId
          );
        });

        applyCollisionVisualEffects(timestamp);
        applyPaddleCollisionEffects(collidedWithPaddle, timestamp);
        const hueRotationAmount = truncateDigits(HUE_PER_TICK * delta, 1);

        incrementHueRotation({
          ball: hueRotationAmount,
          paddle: hueRotationAmount,
        });
        maybeAddBallTrail();

        translatePaddle();
        translateBall(nextBall);

        currentBall.x = nextBall.x;
        currentBall.y = nextBall.y;
        requestAnimationFrame(loop);
      } catch (e) {
        console.log("MAIN LOOP ERROR: ", e);
        console.log("TRACE: ", e.stack);
      }
    }

    function beginLoop() {
      lastFrameTime = performance.now();
      paddleElement.classList.remove("slide-in-from-bottom");
      ballElement.classList.remove("slide-in-from-bottom");
      startPaddleListeners();
      requestAnimationFrame(loop);
    }

    return beginLoop;
  }

  const handleDeclineEvents = async () => {
    const observer = startDismissObserver();
    const arr = Array.from(destroyedEvents);
    for (let i = 0; i < arr.length; i++) {
      arr[i].click();
      await waitForDialogsToClear();
    }
    destroyedEvents.clear();
    observer.disconnect();
  };

  const makeTimedOutModal = () => {
    createEventDeclineModal("Timed Out!", handleDeclineEvents);
  };

  const stopGameAutomatically = setTimeout(() => {
    console.log("STOPPING");
    RUN_GAME = false;
    makeTimedOutModal();
  }, STOP_AFTER_THIS_MANY_TICKS * TICK_TIME);

  const stopGame = () => {
    RUN_GAME = false;
    clearTimeout(stopGameAutomatically);
  };

  const makeGameOverModal = () => {
    createEventDeclineModal("Game Over!", handleDeclineEvents);
    stopGame();
  };

  const makeWonGameModal = () => {
    createEventDeclineModal("All Meetings Destroyed!", handleDeclineEvents);
    stopGame();
  };

  const runMainLoop = mainLoop({ makeGameOverModal, makeWonGameModal });

  function applyInitialTranslations() {
    translateBall(currentBall);
    translatePaddle();
  }
  applyInitialTranslations();

  const listener = document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !RUN_GAME) {
      console.log("STARTING");
      RUN_GAME = true;
      runMainLoop();
      document.removeEventListener("keydown", listener);
    }
  });
};

function resetEvents() {
  getEvents().forEach((event, i) => {
    event.classList.remove("faded");
    event.dataset.intersected = "";
  });
}

resetEvents();
main();

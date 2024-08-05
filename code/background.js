chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({
    text: "",
  });
});

const google = "https://calendar.google.com/calendar/";
const outlookStart = "https://outlook";
const outlookEnd = ".com/calendar";

const getNextState = async (tabId) => {
  const prevState = await chrome.action.getBadgeText({ tabId });
  return prevState === "ON" ? "OFF" : "ON";
};

const injectCss = async (tabId) => {
  const cssArgs = { files: ["./code/style.css"], target: { tabId } };
  await chrome.scripting.insertCSS(cssArgs);
};

const injectJs = async (tabId) => {
  const jsArgs = { files: ["./code/main.js"], target: { tabId } };
  await chrome.scripting.executeScript(jsArgs);
};

const removeCss = async (tabId) => {
  const cssArgs = { files: ["./code/style.css"], target: { tabId } };
  await chrome.scripting.removeCSS(cssArgs);
};

chrome.action.onClicked.addListener(async (tab) => {
  let nextState;
  nextState = await getNextState(tab.id);
  await chrome.action.setBadgeText({
    tabId: tab.id,
    text: nextState === "ON" ? "ON" : "",
  });

  if (nextState === "ON") {
    console.log("injecting css and js");
    await injectCss(tab.id);
    if ((tab.url.startsWith(outlookStart) && tab.url.includes(outlookEnd)) || (tab.url.startsWith(google))) {
      await injectJs(tab.id);
    }
  } else if (nextState === "OFF") {
    chrome.tabs.sendMessage(tab.id, { action: "stopGame" });
    await removeCss(tab.id);
  }
});

chrome.runtime.onMessage.addListener(async function (
  request,
  sender,
  sendResponse
) {
  if (request.action === "gameFinished") {
    const nextState = await getNextState(sender.tab.id);
    if (nextState === "OFF") {
      await removeCss(sender.tab.id);
      await chrome.action.setBadgeText({
        tabId: sender.tab.id,
        text: "",
      });
    } else if (nextState === "ON") {
      console.error("ERROR: Game finished but state wants to flip back to on?");
    }
  }
});

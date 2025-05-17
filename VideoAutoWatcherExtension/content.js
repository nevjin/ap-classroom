var USERID = 123456789; //  Replace with your user ID (Can be found through console and printing variable: window.current_user.initId)

function clickElementByXPath() {
  const xPath = '//*[@id="main-content"]/div[3]/div[7]/div/div/div[1]/div[2]/button';
  const result = document.evaluate(xPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  const element = result.singleNodeValue;
  if (element) {
    element.click();
  } else {
    console.log('Element not found');
  }
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.videoId) {
      completeVideo(message.videoId);
    }
  });
  const getVideoDuration = (callback, retryCount = 0) => {
    const video = document.getElementsByTagName('video')[0];

    if (video && video.duration && !isNaN(video.duration)) {
      callback(video.duration);  
    } else if (retryCount < 10) {  
      setTimeout(() => getVideoDuration(callback, retryCount + 1), 500);  
    } else {
      console.error('Unable to get video duration after multiple attempts.');
    }
  };

  const completeVideo = async (videoId) => {
    getVideoDuration(async (duration) => {
    const progress = new Array(Math.ceil(duration)).fill(1);
    const accessToken = window.localStorage.getItem("account_access_token");

    const data = {
      "query": "mutation StoreDailyVideoProgressMutation($userId: Int!, $cbPersonid: String!, $videoId: Int!, $status: String!, $progress: String!, $watchedPercentage: String!, $playTimePercentage: String) {\n  storeDailyVideoProgress(userId: $userId, videoId: $videoId, status: $status, cbPersonid: $cbPersonid, progress: $progress, watchedPercentage: $watchedPercentage, playTimePercentage: $playTimePercentage) {\n    ok\n    __typename\n  }\n}\n",
      "variables": {
        "userId": USERID, 
        "videoId": videoId,
        "progress": progress,
        "status": "COMPLETE",
        "cbPersonid": USERID, 
        "watchedPercentage": "1.00",
        "playTimePercentage": "1.0000"
      },
      "operationName": "StoreDailyVideoProgressMutation"
    };

    await fetch("https://apc-api-production.collegeboard.org/fym/graphql", {
      "headers": {
        "accept": "*/*",
        "authorization": `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      "method": "POST",
      "body": JSON.stringify(data)
    });

    clickElementByXPath();
});
  };
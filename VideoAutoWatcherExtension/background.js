chrome.webRequest.onBeforeRequest.addListener(
  (details) => {

    if (details.tabId < 0) {

      return; 
    }

    if (details.url.includes("graphql") && details.requestBody?.raw?.[0]?.bytes) {
      try {
        const requestBody = decodeURIComponent(
          String.fromCharCode.apply(null, new Uint8Array(details.requestBody.raw[0].bytes))
        );
        const requestData = JSON.parse(requestBody);
        const videoId = requestData.variables?.videoId;

        if (videoId) {
          console.log("Found videoId:", videoId, "for tab:", details.tabId);

          chrome.tabs.sendMessage(details.tabId, { videoId: videoId }, (response) => {

            if (chrome.runtime.lastError) {

              console.warn(`Error sending message to tab ${details.tabId}: ${chrome.runtime.lastError.message}`);
            } else {

            }
          });
        }
      } catch (e) {
        console.error("Error processing request body:", e);

      }
    }
  },

  { urls: ["*://apc-api-production.collegeboard.org/fym/graphql"] },

  ["requestBody"]
);


class Background {
  private tabIds: Map<number, string>;
  private currentTab: number | undefined;

  constructor() {
    this.tabIds = new Map();

    this.disableExtension();

    chrome.tabs.query(
      {
        active: true,
        currentWindow: true
      },
      (tabs) => {
        if (tabs.length === 0) {
          return;
        }

        this.currentTab = tabs[0].id;
      }
    );

    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.currentTab = activeInfo.tabId;

      if (this.tabIds.has(this.currentTab)) {
        this.enableExtension();
      } else {
        this.disableExtension();
      }
    })

    chrome.tabs.onUpdated.addListener(this.sendMessage);
    chrome.webRequest.onBeforeRequest.addListener(
      this.processRequest,
      { urls: ['<all_urls>'] },
    );

    chrome.browserAction.onClicked.addListener(() => {
      if (typeof this.currentTab === 'undefined') {
        return;
      }

      chrome.tabs.query(
        {
          active: true,
          currentWindow: true,
          url: '*://*.youtube.com/*'
        },
        (tabs) => {
          if (tabs.length === 0 || !tabs[0].id) {
            return;
          }

          if (this.tabIds.has(tabs[0].id)) {
            this.tabIds.delete(tabs[0].id!);
            this.disableExtension();
          } else {
            this.tabIds.set(tabs[0].id, '');
            this.enableExtension();
          }

          chrome.tabs.update(tabs[0].id, { url: tabs[0].url });
        }
      );
    });
  }

  removeURLParameters = (url: string, parameters: any[]) => {
    const urlParts = url.split('?');
    if (urlParts.length < 2) return;

    let currentParameters = urlParts[1].split(/[&;]/g);
    const encodedParameters = parameters.map(
      (para) => `${encodeURIComponent(para)}=`
    );
    const filteredParameters = currentParameters.filter(
      (p) => !encodedParameters.some((enc) => p.startsWith(enc))
    );

    return `${urlParts[0]}?${filteredParameters.join('&')}`;
  };

  processRequest = (details: chrome.webRequest.WebRequestBodyDetails) => {
    const { url, tabId } = details;

    if (!this.tabIds.has(tabId)
            || !url.includes('mime=audio')
            || url.includes('live=1')) {
      return;
    }

    const parametersToBeRemoved = ['range', 'rn', 'rbuf'];
    const audioURL = this.removeURLParameters(url, parametersToBeRemoved);
    if (audioURL && this.tabIds.get(tabId) !== audioURL) {
      this.tabIds.set(tabId, audioURL);
      this.sendMessage(tabId);
    }
  };

  sendMessage = (tabId: number) => {
    if (!this.tabIds.has(tabId)) {
      return;
    }

    chrome.tabs.sendMessage(tabId, {
      url: this.tabIds.get(tabId),
    });
  };

  enableExtension = () => {
    chrome.browserAction.setIcon({
      path: {
        19: 'img/icon19.png',
        38: 'img/icon38.png',
      },
    });
  };

  disableExtension = () => {
    chrome.browserAction.setIcon({
      path: {
        19: 'img/disabled_icon19.png',
        38: 'img/disabled_icon38.png',
      },
    });
  };
}

const background = new Background();

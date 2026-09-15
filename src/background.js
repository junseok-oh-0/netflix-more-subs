chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason == 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('tutorial.html') });
  }
});

const preferences = {
  font_multiplier: 1,
  text_color: '#FFFFFF',
  opacity: 0.8,
  on_off: 1,
  button_on_off: 1,
  originaltext_opacity: 1,
  button_up_down_mode: 1,
  originaltext_color: '#fff000',
};

// BUG: truthy checks treat stored 0/false as missing and reset them (fixed in Phase 2)
chrome.storage.sync.get('font_multiplier', function (data) {
  if (data.font_multiplier != null) {
    preferences['font_multiplier'] = data.font_multiplier;
  } else {
    chrome.storage.sync.set({ font_multiplier: 1 });
  }
});

chrome.storage.sync.get('text_color', function (data) {
  if (data.text_color) {
    preferences['text_color'] = data.text_color;
  } else {
    chrome.storage.sync.set({ text_color: '#FFFFFF' });
  }
});

chrome.storage.sync.get('opacity', function (data) {
  if (data.opacity) {
    preferences['opacity'] = data.opacity;
  } else {
    chrome.storage.sync.set({ opacity: 0.8 });
  }
});

chrome.storage.sync.get('on_off', function (data) {
  if (data.on_off != null) {
    preferences['on_off'] = data.on_off;
  } else {
    chrome.storage.sync.set({ on_off: 1 });
  }
});

chrome.storage.sync.get('button_on_off', function (data) {
  if (data.button_on_off != null) {
    preferences['button_on_off'] = data.button_on_off;
  } else {
    chrome.storage.sync.set({ button_on_off: 1 });
  }
});

chrome.storage.sync.get('originaltext_opacity', function (data) {
  if (data.originaltext_opacity) {
    preferences['originaltext_opacity'] = data.originaltext_opacity;
  } else {
    chrome.storage.sync.set({ originaltext_opacity: 1 });
  }
});

chrome.storage.sync.get('originaltext_color', function (data) {
  if (data.originaltext_color) {
    preferences['originaltext_color'] = data.originaltext_color;
  } else {
    chrome.storage.sync.set({ originaltext_color: '#fff000' });
  }
});

chrome.storage.sync.get('button_up_down_mode', function (data) {
  if (data.button_up_down_mode) {
    preferences['button_up_down_mode'] = data.button_up_down_mode;
  } else {
    chrome.storage.sync.set({ button_up_down_mode: 1 });
  }
});

// Preference changes from the popup / settings panel: store, then forward to the content script
chrome.runtime.onMessage.addListener(function (request) {
  if (request.message === 'request_preferences') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'user_preferences',
        value: preferences,
      });
    });
  }

  if (request.message === 'open_settings_menu') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'open_settings_menu',
        value: '0',
      });
    });
  }

  if (request.message === 'open_popup') {
    chrome.tabs.create({ url: chrome.runtime.getURL('tutorial.html') });
  }

  if (request.message === 'update_on_off') {
    chrome.storage.sync.set({ on_off: request.value });
    preferences['on_off'] = request.value;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'update_on_off',
        value: request.value,
      });
    });
  }

  if (request.message === 'update_button_on_off') {
    chrome.storage.sync.set({ button_on_off: request.value });
    preferences['button_on_off'] = request.value;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'update_button_on_off',
        value: request.value,
      });
    });
  }

  if (request.message === 'update_button_up_down_mode') {
    chrome.storage.sync.set({ button_up_down_mode: request.value });
    preferences['button_up_down_mode'] = request.value;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'update_button_up_down_mode',
        value: request.value,
      });
    });
  }

  if (request.message === 'update_font_multiplier') {
    chrome.storage.sync.set({ font_multiplier: parseFloat(request.value) });
    preferences['font_multiplier'] = parseFloat(request.value);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'update_font_multiplier',
        value: request.value,
      });
    });
  }

  if (request.message === 'update_text_color') {
    chrome.storage.sync.set({ text_color: request.value });
    preferences['text_color'] = request.value;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'update_text_color',
        value: request.value,
      });
    });
  }

  if (request.message === 'update_opacity') {
    chrome.storage.sync.set({ opacity: request.value });
    preferences['opacity'] = request.value;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'update_opacity',
        value: request.value,
      });
    });
  }

  if (request.message === 'update_originaltext_opacity') {
    chrome.storage.sync.set({ originaltext_opacity: request.value });
    preferences['originaltext_opacity'] = request.value;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'update_originaltext_opacity',
        value: request.value,
      });
    });
  }

  if (request.message === 'update_originaltext_color') {
    chrome.storage.sync.set({ originaltext_color: request.value });
    preferences['originaltext_color'] = request.value;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        message: 'update_originaltext_color',
        value: request.value,
      });
    });
  }
});

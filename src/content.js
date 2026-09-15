// Dual Subtitles for Netflix - content script
//
// Netflix ships two class-name variants ("normal" and one where everything ends in "Css");
// both are handled inline via window.weird_classname_mode.
// Chrome and Edge translators behave differently; both are handled here via window.edge.

import { DEFAULT_PREFERENCES, loadPreferences, onPreferencesChanged } from './preferences.js';

window.weird_classname_mode = 0;

// UA sniffing is not foolproof but good enough to pick the translator workaround.
window.edge = window.navigator.userAgent.includes('Edg/') ? 1 : 0;

// Storage is the single source of truth; the popup writes to it and this script reacts.
loadPreferences()
  .catch(() => DEFAULT_PREFERENCES)
  .then(applyPreferences);
onPreferencesChanged(applyPreferenceChange);

function waitForElement(selector) {
  return new Promise(function (resolve) {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.matches && node.matches(selector)) {
            observer.disconnect();
            resolve(node);
            return;
          }
        }
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

function applyPreferences(prefs) {
  window.on_off = prefs['on_off'];
  window.up_down_mode = prefs['button_up_down_mode'];
  window.current_multiplier = prefs['font_multiplier'];
  window.opacity = prefs['opacity'];
  window.originaltext_opacity = prefs['originaltext_opacity'];
  window.originaltext_color = prefs['originaltext_color'];
  window.text_color = prefs['text_color'];
}

function wait_for_player_to_finish_loading() {
  // Waiting for flex elements doesn't work, so the full path is used instead
  waitForElement(
    '#appMountPoint > div > div >div > div > div > div:nth-child(1) > div > div > div > div',
  ).then(function () {
    try {
      actual_create_buttons();
    } catch {
      // likely no bar visible
    }

    // 1 would flip the text sides; disabled since the text moves too much
    window.original_text_side = 0;

    llsubs();
  });
}

// Main observer: detects video changes.
// Netflix remounts .watch-video--player-view under .watch-video for every video, and unlike the
// hashed ltr-* class names these two survive Netflix UI updates.
window.video_change_observer_config = { childList: true, subtree: true };

const video_change_callback = function (mutationsList) {
  for (const mutation of mutationsList) {
    if (
      mutation.target.className == 'watch-video' &&
      mutation.addedNodes &&
      mutation.addedNodes.length > 0 &&
      mutation.addedNodes[0].className == 'watch-video--player-view'
    ) {
      prepare_for_dual_subs();
    }
  }
};
window.video_change_observer = new MutationObserver(video_change_callback);
window.video_change_observer.observe(document.documentElement, window.video_change_observer_config);

// Starts the observer that waits for the player to finish loading after a page/video change
function prepare_for_dual_subs() {
  enable_right_click();

  try {
    actual_create_buttons();
  } catch {
    return;
  }

  // Buttons can no longer be created before the bottom bar is visible,
  // so creation is moved to after the player is detected.
  initialize_button_observer();
  wait_for_player_to_finish_loading();
}

// Netflix blocks the context menu, which the user needs to trigger the browser translator
function enable_right_click() {
  const elements = document.getElementsByTagName('*');
  for (let i = 0; i < elements.length; ++i) {
    elements[i].addEventListener(
      'contextmenu',
      function (e) {
        e.stopPropagation();
      },
      true,
    );
    elements[i].oncontextmenu = null;
  }
}

function actual_create_buttons() {
  if (document.getElementById('myTutorialButton')) {
    return;
  }

  let buttonSpacing = document.createElement('DIV');
  buttonSpacing.innerHTML = '<div class="ltr-1npqywr" style="min-width: 3rem; width: 3rem;"></div>';
  buttonSpacing = buttonSpacing.firstElementChild;
  try {
    document
      .querySelector('button[aria-label="Seek Back"]')
      .parentElement.parentElement.appendChild(buttonSpacing);
  } catch {
    return;
  }

  let buttonOne = document.createElement('DIV');

  let button_top_color = window.text_color;
  let button_bottom_color = window.originaltext_color;
  if (!button_bottom_color && !button_top_color) {
    button_top_color = 'yellow';
    button_bottom_color = 'white';
  }

  buttonOne.innerHTML = `<div class="medium ltr-1dcjcj4" id="myTutorialButton"><button aria-label="Open Tutorial" class=" ltr-1enhvti" data-uia="control-fontsize-minus">\
    <div class="control-medium ltr-iyulz3" role="presentation"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="Hawkins-Icon Hawkins-Icon-Standard">\
    <g xmlns="http://www.w3.org/2000/svg"><rect stroke-width="2" stroke="white" id="svg_2" height="14" width="22" y="4.93751" x="1" fill="transparent"></rect>\
    <path stroke="#000" id="dsubs_svg_9" d="m3.01532,8.13163l9.68748,0l0,2.5l-9.68748,0l0,-2.5z" stroke-width=".5" fill="${button_bottom_color}"></path>\
    <path stroke="#000" id="dsubs_svg_12" d="m13.48405,8.16288l7.28124,0l0,2.49999l-7.28124,0l0,-2.49999z" stroke-width=".5" fill="${button_bottom_color}"></path>\
    <path opacity="0.7" stroke="#000" id="dsubs_svg_13" d="m4.14032,12.10037l9.96874,0l0,1.81249l-9.96874,0l0,-1.81249z" stroke-width=".5" fill="${button_top_color}"></path>\
    <path opacity="0.7" stroke="#000" id="dsubs_svg_15" d="m14.60905,12.13162l5.40625,0l0,1.81249l-5.40625,0l0,-1.81249z" stroke-width=".5" fill="${button_top_color}"></path></g></svg></div></button></div>`;
  if (window.weird_classname_mode) {
    buttonOne.innerHTML =
      '<div class="medium ltr-1dcjcj4" id="myTutorialButton"><button aria-label="Open Tutorial" class=" ltr-1enhvti" data-uia="control-fontsize-minus"><div class="control-medium ltr-iyulz3" role="presentation"><svg width="24" height="24" viewBox="-1 0 24 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="Hawkins-Icon Hawkins-Icon-Standard"><g xmlns="http://www.w3.org/2000/svg"><rect stroke-width="2" stroke="white" id="svg_2" height="14" width="22" y="4.93751" x="1" fill="transparent"></rect><path stroke="#000" id="svg_9" d="m3.01532,8.13163l9.68748,0l0,2.5l-9.68748,0l0,-2.5z" stroke-width=".5" fill="yellow"></path><path stroke="#000" id="svg_12" d="m13.48405,8.16288l7.28124,0l0,2.49999l-7.28124,0l0,-2.49999z" stroke-width=".5" fill="yellow"></path><path opacity="0.7" stroke="#000" id="svg_13" d="m4.14032,12.10037l9.96874,0l0,1.81249l-9.96874,0l0,-1.81249z" stroke-width=".5" fill="white"></path><path opacity="0.7" stroke="#000" id="svg_15" d="m14.60905,12.13162l5.40625,0l0,1.81249l-5.40625,0l0,-1.81249z" stroke-width=".5" fill="white"></path></g></svg></div></button></div>';
  }
  buttonOne = buttonOne.firstElementChild;

  try {
    document
      .querySelector('button[aria-label="Seek Back"]')
      .parentElement.parentElement.appendChild(buttonOne);
  } catch {
    return;
  }
  buttonOne.onmouseenter = function () {
    if (window.weird_classname_mode) {
      buttonOne.firstChild.className = 'active ltr-1enhvti-controlButtonCss';
    } else {
      buttonOne.firstChild.className = 'active ltr-1enhvti';
    }
  };
  buttonOne.onmouseleave = function () {
    if (window.weird_classname_mode) {
      buttonOne.firstChild.className = ' ltr-1enhvti-controlButtonCss';
    } else {
      buttonOne.firstChild.className = ' ltr-1enhvti';
    }
  };

  buttonOne.addEventListener('click', function () {
    open_settings_menu();
  });
}

function open_settings_menu() {
  if (document.getElementById('dsubs_settings-panel')) {
    document.getElementById('dsubs_settings-panel').remove();
    return;
  }
  fetch(chrome.runtime.getURL('/settings_box.html'))
    .then((r) => r.text())
    .then((html) => {
      // insertAdjacentHTML rather than innerHTML so the page's own listeners survive
      document.body.insertAdjacentHTML('beforeend', html);
      draggable(document.getElementById('dsubs_banner'));
      closeable(document.getElementById('dsubs_x-button'));
      applyPreferencesToSettingsMenu();
    });
}

function closeable(el) {
  el.addEventListener('mousedown', function () {
    document.getElementById('dsubs_settings-panel').remove();
  });
}

function draggable(el) {
  el.addEventListener('mousedown', function (e) {
    const container = document.getElementById('dsubs_settings-panel');
    if (!container) return;

    const offsetX = e.clientX - parseInt(window.getComputedStyle(container).left);
    const offsetY = e.clientY - parseInt(window.getComputedStyle(container).top);

    function mouseMoveHandler(e) {
      container.style.top = e.clientY - offsetY + 'px';
      container.style.left = e.clientX - offsetX + 'px';
    }

    function reset() {
      window.removeEventListener('mousemove', mouseMoveHandler);
      window.removeEventListener('mouseup', reset);
    }

    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', reset);
  });
}

function applyPreferencesToSettingsMenu() {
  const translatedTextSizeSlider = document.getElementById('dsubs_translatedTextSizeSlider');
  const translatedTextSizeSliderValue = document.getElementById('dsubs_translatedTextSizeSliderValue');

  const originalOpacitySlider = document.getElementById('dsubs_originalOpacitySlider');
  const originalOpacitySliderValue = document.getElementById('dsubs_originalOpacitySliderValue');

  const translatedOpacitySlider = document.getElementById('dsubs_translatedOpacitySlider');
  const translatedOpacitySliderValue = document.getElementById('dsubs_translatedOpacitySliderValue');

  const originalColorPicker = document.getElementById('dsubs_originalColorPicker');
  const translatedColorPicker = document.getElementById('dsubs_translatedColorPicker');
  const logoOriginalText = document.getElementById('dsubs_logo-top');
  const logoTranslatedText = document.getElementById('dsubs_logo-bot');

  const restoreDefaultsButton = document.getElementById('dsubs_restoreDefaultsButton');

  const enableSubsValue = document.getElementById('dsubs_enableSubsValue');
  const enableStackedSubsValue = document.getElementById('dsubs_enableStackedSubsValue');

  translatedTextSizeSlider.value = window.current_multiplier;
  translatedTextSizeSliderValue.innerHTML = window.current_multiplier;

  translatedOpacitySlider.value = window.opacity;
  translatedOpacitySliderValue.innerHTML = window.opacity;

  originalOpacitySlider.value = window.originaltext_opacity;
  originalOpacitySliderValue.innerHTML = window.originaltext_opacity;

  translatedColorPicker.value = window.text_color;
  logoTranslatedText.style.color = window.text_color;

  originalColorPicker.value = window.originaltext_color;
  logoOriginalText.style.color = window.originaltext_color;

  enableSubsValue.checked = window.on_off;
  enableStackedSubsValue.checked = window.up_down_mode;

  restoreDefaultsButton.addEventListener(
    'click',
    function () {
      translatedColorPicker.value = '#FFFFFF';
      translatedColorPicker.dispatchEvent(new Event('input'));

      originalColorPicker.value = '#FFF000';
      originalColorPicker.dispatchEvent(new Event('input'));

      translatedOpacitySlider.value = 0.8;
      translatedOpacitySlider.dispatchEvent(new Event('change'));
      originalOpacitySlider.value = 1;
      originalOpacitySlider.dispatchEvent(new Event('change'));

      translatedTextSizeSlider.value = 1;
      translatedTextSizeSlider.dispatchEvent(new Event('change'));
    },
    false,
  );

  translatedTextSizeSlider.addEventListener(
    'change',
    function () {
      translatedTextSizeSliderValue.innerHTML = this.value;
      translatedTextSizeSlider.value = this.value;
      chrome.runtime.sendMessage({
        message: 'update_font_multiplier',
        value: this.value,
      });
    },
    false,
  );

  translatedOpacitySlider.addEventListener(
    'change',
    function () {
      translatedOpacitySliderValue.innerHTML = this.value;
      translatedOpacitySlider.value = this.value;
      logoTranslatedText.style.opacity = this.value;
      chrome.runtime.sendMessage({
        message: 'update_opacity',
        value: this.value,
      });
    },
    false,
  );

  originalOpacitySlider.addEventListener(
    'change',
    function () {
      originalOpacitySliderValue.innerHTML = this.value;
      originalOpacitySlider.value = this.value;
      logoOriginalText.style.opacity = this.value;
      chrome.runtime.sendMessage({
        message: 'update_originaltext_opacity',
        value: this.value,
      });
    },
    false,
  );

  translatedColorPicker.addEventListener(
    'input',
    function () {
      translatedColorPicker.value = this.value;
      logoTranslatedText.style.color = this.value;
      chrome.runtime.sendMessage({
        message: 'update_text_color',
        value: this.value,
      });
    },
    false,
  );

  originalColorPicker.addEventListener(
    'input',
    function () {
      originalColorPicker.value = this.value;
      logoOriginalText.style.color = this.value;
      chrome.runtime.sendMessage({
        message: 'update_originaltext_color',
        value: this.value,
      });
    },
    false,
  );

  enableSubsValue.addEventListener(
    'change',
    function () {
      chrome.runtime.sendMessage({
        message: 'update_on_off',
        value: this.checked,
      });
    },
    false,
  );

  enableStackedSubsValue.addEventListener(
    'change',
    function () {
      chrome.runtime.sendMessage({
        message: 'update_button_up_down_mode',
        value: this.checked,
      });
    },
    false,
  );

  // Tab switching
  document.getElementById('dsubs_help_button').onclick = function () {
    Array.from(document.querySelectorAll('.dsubs_activetab')).forEach((element) => {
      element.classList.remove('dsubs_activetab');
    });
    document.getElementById('dsubs_help_tab').classList.add('dsubs_activetab');
  };
  document.getElementById('dsubs_preference_button').onclick = function () {
    Array.from(document.querySelectorAll('.dsubs_activetab')).forEach((element) => {
      element.classList.remove('dsubs_activetab');
    });
    document.getElementById('dsubs_preference_tab').classList.add('dsubs_activetab');
  };
  document.getElementById('dsubs_donate_button').onclick = function () {
    Array.from(document.querySelectorAll('.dsubs_activetab')).forEach((element) => {
      element.classList.remove('dsubs_activetab');
    });
    document.getElementById('dsubs_donation_tab').classList.add('dsubs_activetab');
  };
}

// Tracks the bottom playback bar; Netflix destroys it rather than hiding it,
// so the buttons have to be re-created every time it appears.
function initialize_button_observer() {
  const bottom_bar = document.getElementsByClassName('watch-video--player-view')[0];

  window.button_config = { subtree: true, childList: false, attributes: true, attributeFilter: ['class'] };

  const possible_bottom_bar_classnames = [
    'active ltr-fntwn3',
    'active ltr-omkt8s',
    'active ltr-gwjau2-playerCss',
  ];

  const callback = function () {
    // works but expensive
    for (const curr_class_name of possible_bottom_bar_classnames) {
      const check_for_bar = document.getElementsByClassName(curr_class_name);
      // BUG: HTMLCollection is always truthy (fixed in Phase 4)
      if (check_for_bar) {
        actual_create_buttons();
        break;
      }
    }
  };

  window.button_observer = new MutationObserver(callback);
  window.button_observer.observe(bottom_bar, window.button_config);
}

function llsubs() {
  enable_right_click();

  const timedtext = document.getElementsByClassName('player-timedtext')[0]; // Original container

  // Should actually happen after video exit rather than before video start; text lingers a bit on exit
  document.querySelectorAll('.my-timedtext-container').forEach((el) => el.remove());
  try {
    document.querySelector('.injected-style').remove();
  } catch {
    // no injected css
  }

  const watch_video = document.querySelector('.watch-video');
  if (window.up_down_mode) {
    // Stacked subtitles. pointer-events: none keeps big text from blocking the seekbar
    watch_video.insertAdjacentHTML(
      'beforeend',
      `<div class='my-timedtext-container' style='pointer-events: none; display: block; white-space: nowrap; max-width:100%; text-align: center; position: absolute; left: 50%; bottom: 22%;-webkit-transform: translateX(-50%); transform: translateX(-50%); font-size:21px;line-height:normal;font-weight:normal;color:#ffffff;text-shadow:#000000 0px 0px 7px;font-family:Netflix Sans,Helvetica Nueue,Helvetica,Arial,sans-serif;font-weight:bolder'><span id=my_subs_innertext></span></div>`,
    );

    if (window.on_off) {
      // Hides <br>s to keep things on one line
      const st = document.createElement('style');
      st.innerText =
        '.player-timedtext br{content: "";}' +
        '.my-timedtext-container br{content: "";}' +
        '.player-timedtext br:after{content: " ";}' +
        '.my-timedtext-container br:after{content: " ";}';
      st.className = 'injected-style';
      document.head.appendChild(st);
    }
  } else {
    // Left-right subtitles
    watch_video.insertAdjacentHTML(
      'beforeend',
      `<div class='my-timedtext-container' style='display: block; white-space: pre-wrap; text-align: center; position: absolute; left: 2.5%; bottom: 18%; font-size:21px;line-height:normal;font-weight:normal;color:#ffffff;text-shadow:#000000 0px 0px 7px;font-family:Netflix Sans,Helvetica Nueue,Helvetica,Arial,sans-serif;font-weight:bolder'><span id=my_subs_innertext></span></div>`,
    );
  }

  // Tracks when a translation happens, to deal with text going offscreen
  const translation_tracker_callback = function (mutationsList) {
    for (const mutation of mutationsList) {
      if (
        mutation.target.className === 'my-timedtext-container' &&
        mutation.type === 'attributes' &&
        mutation.attributeName === '_msttexthash'
      ) {
        // Edge
        const lines = document.querySelector('.my-timedtext-container');
        let temp_size = parseFloat(lines.style['font-size'].replace('px', ''));
        while (lines.offsetWidth > lines.parentNode.clientWidth - 50 && temp_size > 8) {
          temp_size -= 2;
          lines.style['font-size'] = temp_size + 'px';
        }
      } else if (
        mutation.target.className === 'my-timedtext-container' &&
        mutation.addedNodes.length == 1 &&
        mutation.addedNodes[0].nodeName === 'FONT'
      ) {
        // Chrome
        const lines = document.querySelector('.my-timedtext-container');
        let temp_size = parseFloat(lines.style['font-size'].replace('px', ''));
        while (lines.offsetWidth > lines.parentNode.clientWidth - 50 && temp_size > 8) {
          temp_size -= 2;
          lines.style['font-size'] = temp_size + 'px';
        }
      }
    }
  };
  window.translation_tracker_config = { attributes: true, childList: true, subtree: true };

  window.my_timedtext_element = document.getElementsByClassName('my-timedtext-container')[0];
  window.my_timedtext_element.setAttribute('translate', 'yes');
  window.last_subs = '';

  // For placement
  window.old_inset = timedtext.style.inset;
  // Original text is placed at left: 5%; using .right on original subs wasn't consistent
  window.original_subs_placement =
    parseInt(document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().width) * 0.025;

  window.config = { attributes: true, childList: true, subtree: true, attributeFilter: ['style'] };

  window.old_text = '';

  // Observes the original text box for changes
  const callback = function (mutationsList) {
    for (const mutation of mutationsList) {
      if (
        mutation.type === 'childList' &&
        mutation.target.className &&
        mutation.target.className === 'player-timedtext'
      ) {
        if (mutation.addedNodes.length === 1) {
          if (mutation.target.innerText !== window.old_text) {
            window.old_text = mutation.target.innerText;
          }

          this.disconnect(); // stop observing so subs can be added without triggering this infinitely
          addSubs(timedtext);
        } else {
          // No children means the mutation was a subtitle CLEAR rather than a refresh
          if (mutation.target.childElementCount === 0) {
            document.getElementsByClassName('my-timedtext-container')[0].innerText = '';
            window.last_subs = '';
          }
        }
      } else if (
        window.on_off &&
        mutation.type === 'attributes' &&
        mutation.target.className === 'player-timedtext' &&
        mutation.target.firstChild &&
        mutation.target.style.inset != window.old_inset
      ) {
        // Adjusts subtitle style when the window is resized.
        // Netflix constantly refreshes the text so styles have to be constantly reapplied.
        try {
          // Spoofs the Edge translator into skipping, since the translate attribute doesn't work there
          Array.from(document.querySelector('.player-timedtext').children).forEach((e) =>
            e.setAttribute('_istranslated', '1'),
          );
        } catch {
          // no subs
        }

        const caption_row = document.getElementsByClassName('player-timedtext')[0];
        if (caption_row.childElementCount == 2) {
          // Netflix sometimes uses a separate container per row; force it back into one
          document.getElementsByClassName('player-timedtext-text-container')[0].firstChild.innerText =
            document.getElementsByClassName('player-timedtext-text-container')[0].firstChild.innerText +
            '\n ' +
            document.getElementsByClassName('player-timedtext-text-container')[1].firstChild.innerText;
          document.getElementsByClassName('player-timedtext-text-container')[1].remove();
        }

        // Font size changes often, so take the base font after every clear
        window.baseFont = parseFloat(
          mutation.target.firstChild.firstChild.firstChild.style.fontSize.replace('px', ''),
        );
        window.current_size = window.baseFont * window.current_multiplier + 'px';
        update_style('font_size');

        if (window.up_down_mode) {
          // BUG: these set properties on the element, not on .style (no-op; fixed in Phase 4)
          window.my_timedtext_element.left = '50%';
          window.my_timedtext_element.transform = 'translate(-50%)';
          window.my_timedtext_element.webkitTransform = 'translateX(-50%)';
        } else {
          if (window.original_text_side == 0) {
            window.original_subs_placement =
              parseInt(document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().x) +
              parseInt(document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().width) *
                0.025;
            const sub_dist =
              parseInt(
                document.getElementsByClassName('player-timedtext')[0].firstChild.getBoundingClientRect()
                  .width,
              ) +
              window.original_subs_placement +
              10;
            window.my_timedtext_element.style['left'] = sub_dist + 'px';
          } else {
            window.original_subs_placement =
              parseInt(window.my_timedtext_element.getBoundingClientRect().x) +
              parseInt(window.my_timedtext_element.getBoundingClientRect().width);
            const sub_dist =
              window.original_subs_placement +
              10 -
              parseInt(document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().x);
            document.getElementsByClassName('player-timedtext')[0].firstChild.style['left'] = sub_dist + 'px';
          }
        }
      }
    }
  };

  window.observer = new MutationObserver(callback);
  window.observer.observe(timedtext, window.config);

  window.translation_tracker = new MutationObserver(translation_tracker_callback);
  window.translation_tracker.observe(window.my_timedtext_element, window.translation_tracker_config);
}

const addSubs = function (caption_row) {
  // Ensures subs were added rather than removed, probably redundant
  if (caption_row.firstChild != null && window.on_off) {
    const container_count = caption_row.childElementCount;
    try {
      window.baseFont = parseFloat(
        caption_row.firstChild.firstChild.firstChild.style.fontSize.replace('px', ''),
      );
    } catch {
      window.baseFont = parseFloat(caption_row.firstChild.firstChild.style.fontSize.replace('px', ''));
    }
    if (container_count > 1) {
      // Netflix sometimes uses a separate container per row; force it back into one
      const count = caption_row.childElementCount;
      let final_innerText = '';

      const final_style = caption_row.firstChild.firstChild.firstChild.getAttribute('style');

      for (let i = 0; i < count; i++) {
        final_innerText += document.getElementsByClassName('player-timedtext-text-container')[i].firstChild
          .innerText;
        if (i < caption_row.childElementCount - 1) {
          final_innerText += '\n';
        }
      }
      document.getElementsByClassName('player-timedtext-text-container')[0].firstChild.innerText =
        final_innerText;

      for (let j = 0; j < caption_row.childElementCount; j++) {
        document.getElementsByClassName('player-timedtext-text-container')[1].remove();
      }
      document
        .getElementsByClassName('player-timedtext-text-container')[0]
        .firstChild.setAttribute('style', final_style);
    }

    if (window.up_down_mode) {
      // Stacked
      caption_row.firstChild.setAttribute(
        'style',
        'display: block; white-space: nowrap; max-width:100%;text-align: center; position: absolute; left: 50%; bottom:22%; -webkit-transform: translateX(-50%); transform: translateX(-50%);',
      );
    } else {
      // Left-right
      caption_row.firstChild.setAttribute(
        'style',
        'display: block; white-space: pre-wrap; text-align: center; position: absolute; left: 2.5%; bottom: 18%;',
      );
    }
    caption_row.firstChild.setAttribute('translate', 'no'); // stopped working for Edge

    // notranslate on Chrome slows down translation for some reason, so Edge only
    if (window.edge) {
      caption_row.firstChild.className += ' notranslate';
    }

    window.original_subs = caption_row.firstChild.innerText;

    if (window.original_text_side == 1) {
      caption_row.firstChild.style['left'] = '97.5%';
    }

    if (window.original_subs !== window.last_subs) {
      window.last_subs = window.original_subs;
      window.my_timedtext_element.innerText = window.original_subs;
    } else if (window.original_subs === '') {
      // BUG: overwrites the element reference with a string (fixed in Phase 4)
      window.my_timedtext_element = window.original_subs;
    }
    window.current_size = window.baseFont * window.current_multiplier + 'px';

    if (window.up_down_mode) {
      const sub_bot =
        parseFloat(
          document.getElementsByClassName('player-timedtext')[0].style.inset.split(' ')[0].replace('px', ''),
        ) +
        parseFloat('.' + document.getElementsByClassName('player-timedtext')[0].firstChild.style['bottom']) *
          document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().height;
      window.my_timedtext_element.style['bottom'] =
        sub_bot - window.baseFont * window.current_multiplier - 10 + 'px';

      const orig = document.getElementsByClassName('player-timedtext')[0].firstChild;

      // Deal with overflow. In Edge this triggers translation, hence the notranslate on every span.
      let temp_size = window.baseFont;
      while (orig.offsetWidth > orig.parentNode.clientWidth - 150 && temp_size > 8) {
        temp_size -= 2;
        orig.firstChild.firstChild.style.fontSize = temp_size + 'px';

        if (window.edge) {
          orig.firstChild.className += ' notranslate';
        }
        for (
          let i = 0;
          i < document.getElementsByClassName('player-timedtext')[0].firstChild.firstChild.children.length;
          i++
        ) {
          if (window.edge) {
            orig.firstChild.children[i].className += ' notranslate';
          }
          orig.firstChild.children[i].style.fontSize = temp_size + 'px';
        }
      }
    } else {
      const sub_bot =
        parseFloat(
          document.getElementsByClassName('player-timedtext')[0].style.inset.split(' ')[0].replace('px', ''),
        ) +
        parseFloat('.' + document.getElementsByClassName('player-timedtext')[0].firstChild.style['bottom']) *
          document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().height;
      window.my_timedtext_element.style['bottom'] = sub_bot + 'px';

      if (window.original_text_side == 0) {
        window.original_subs_placement =
          parseInt(document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().x) +
          parseInt(document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().width) *
            0.025;
        const sub_dist =
          parseInt(
            document.getElementsByClassName('player-timedtext')[0].firstChild.getBoundingClientRect().width,
          ) +
          window.original_subs_placement +
          10;
        window.my_timedtext_element.style['left'] = sub_dist + 'px';
      } else {
        window.my_timedtext_element.style['left'] = '2.5%';

        // Same but applied to my element instead
        window.original_subs_placement =
          parseInt(window.my_timedtext_element.getBoundingClientRect().x) +
          parseInt(window.my_timedtext_element.getBoundingClientRect().width);
        const sub_dist =
          window.original_subs_placement +
          10 -
          parseInt(document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().x);
        caption_row.firstChild.style['left'] = sub_dist + 'px';
      }
    }

    update_style('text_color');
    update_style('opacity');
    update_style('font_size');
  }

  window.observer.observe(caption_row, window.config);
};

function update_style(setting) {
  const lines = window.my_timedtext_element;
  let original_lines;
  try {
    original_lines = document.getElementsByClassName('player-timedtext')[0].firstChild.firstChild;
  } catch {
    return;
  }

  if (setting === 'font_size') {
    lines.style['font-size'] = window.current_size;
    // Deal with overflowing text
    let temp_size = parseFloat(lines.style['font-size'].replace('px', ''));
    while (lines.offsetWidth > lines.parentNode.clientWidth - 50 && temp_size > 8) {
      temp_size -= 2;
      lines.style['font-size'] = temp_size + 'px';
    }
  } else if (setting === 'text_color') {
    lines.style['color'] = window.text_color;

    document.getElementsByClassName('player-timedtext')[0].firstChild.firstChild.style['color'] =
      window.originaltext_color;

    try {
      // Icon
      document.getElementById('dsubs_svg_9').setAttribute('fill', window.originaltext_color);
      document.getElementById('dsubs_svg_12').setAttribute('fill', window.originaltext_color);
      document.getElementById('dsubs_svg_13').setAttribute('fill', window.text_color);
      document.getElementById('dsubs_svg_15').setAttribute('fill', window.text_color);
    } catch {
      // button probably doesn't exist
    }

    for (
      let i = 0;
      i < document.getElementsByClassName('player-timedtext')[0].firstChild.firstChild.children.length;
      i++
    ) {
      original_lines.children[i].style['color'] = window.originaltext_color;
    }
  } else if (setting === 'opacity') {
    lines.style['opacity'] = window.opacity;
    original_lines.style['opacity'] = window.originaltext_opacity;
  }
}

// Applies one changed preference to the live subtitles. Values arrive normalized from preferences.js.
function applyPreferenceChange(key, value) {
  if (key === 'on_off') {
    window.on_off = value;
    if (!window.on_off) {
      try {
        window.my_timedtext_element.style['display'] = 'none';
        Array.from(document.querySelector('.player-timedtext').querySelectorAll('*')).forEach(
          (e) => (e.style['color'] = '#FFFFFF'),
        );
        document.querySelector('.player-timedtext-text-container').style['left'] = '50%';
        document.querySelector('.player-timedtext-text-container').style['transform'] = 'translate(-50%)';
        document.querySelector('.player-timedtext-text-container').style['-webkit-transform'] =
          'translateX(-50%)';
        document.querySelector('.injected-style').remove();
      } catch {
        // no subs on screen
      }
    } else {
      const st = document.createElement('style');
      st.innerText =
        '.player-timedtext br{content: "";}' +
        '.my-timedtext-container br{content: "";}' +
        '.player-timedtext br:after{content: " ";}' +
        '.my-timedtext-container br:after{content: " ";}';
      st.className = 'injected-style';
      document.head.appendChild(st);

      try {
        window.my_timedtext_element.style['display'] = 'block';

        for (
          let i = 0;
          i < document.getElementsByClassName('player-timedtext')[0].firstChild.children.length;
          i++
        ) {
          document.getElementsByClassName('player-timedtext')[0].firstChild.children[i].style['color'] =
            window.originaltext_color;
        }
      } catch {
        // no subs on screen
      }

      try {
        document.getElementById('myTutorialButton').style.display = 'block';
      } catch {
        actual_create_buttons();
      }
    }
  }

  if (key === 'font_multiplier') {
    window.current_multiplier = value;
    window.current_size = window.baseFont * value + 'px';
    update_style('font_size');
  }

  if (key === 'text_color') {
    window.text_color = value;
    update_style('text_color');
  }

  if (key === 'opacity') {
    window.opacity = value;
    update_style('opacity');
  }

  if (key === 'originaltext_opacity') {
    window.originaltext_opacity = value;
    update_style('opacity');
  }

  if (key === 'originaltext_color') {
    window.originaltext_color = value;

    update_style('text_color');
    try {
      document
        .getElementById('myTutorialButton')
        .firstChild.firstChild.firstChild.firstElementChild.setAttribute('stroke', window.originaltext_color);
    } catch {
      // no button
    }
  }

  if (key === 'button_up_down_mode') {
    window.up_down_mode = value;

    if (!window.up_down_mode) {
      // Turning stacked mode off
      window.my_timedtext_element.style['left'] = '';
      window.my_timedtext_element.style['transform'] = '';
      window.my_timedtext_element.style['-webkit-transform'] = '';
      window.my_timedtext_element.style['white-space'] = 'pre-wrap';
      try {
        document.querySelector('.injected-style').remove();
      } catch {
        // no injected css
      }

      try {
        window.original_subs_placement =
          parseInt(document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().x) +
          parseInt(document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().width) *
            0.025;
        const sub_dist =
          parseInt(
            document.getElementsByClassName('player-timedtext')[0].firstChild.getBoundingClientRect().width,
          ) +
          window.original_subs_placement +
          10;
        window.my_timedtext_element.style['left'] = sub_dist + 'px';

        try {
          document
            .querySelector('.player-timedtext-text-container')
            .setAttribute(
              'style',
              'display: block; white-space: pre-wrap; text-align: center; position: absolute; left: 2.5%; bottom: 18%;',
            );
        } catch {
          // no subs on screen
        }
        const sub_bot =
          parseFloat(
            document
              .getElementsByClassName('player-timedtext')[0]
              .style.inset.split(' ')[0]
              .replace('px', ''),
          ) +
          parseFloat(
            '.' + document.getElementsByClassName('player-timedtext')[0].firstChild.style['bottom'],
          ) *
            document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().height;
        window.my_timedtext_element.style['bottom'] = sub_bot + 'px';
      } catch {
        // no subs on screen
      }
    } else {
      // BUG: missing className='injected-style', so this style can never be removed (fixed in Phase 4)
      const st = document.createElement('style');
      st.innerText =
        '.player-timedtext br{content: "";}' +
        '.my-timedtext-container br{content: "";}' +
        '.player-timedtext br:after{content: " ";}' +
        '.my-timedtext-container br:after{content: " ";}';
      document.head.appendChild(st);

      try {
        window.my_timedtext_element.style['left'] = '50%';
        window.my_timedtext_element.style['transform'] = 'translate(-50%)';
        window.my_timedtext_element.style['-webkit-transform'] = 'translateX(-50%)';
        window.my_timedtext_element.style['white-space'] = 'nowrap';
        try {
          document
            .querySelector('.player-timedtext-text-container')
            .setAttribute(
              'style',
              'display: block; white-space: nowrap; max-width:100%; text-align: center; position: absolute;left: 50%; bottom:20%; -webkit-transform: translateX(-50%); transform: translateX(-50%);',
            );
          const sub_bot =
            parseFloat(
              document
                .getElementsByClassName('player-timedtext')[0]
                .style.inset.split(' ')[0]
                .replace('px', ''),
            ) +
            parseFloat(
              '.' + document.getElementsByClassName('player-timedtext')[0].firstChild.style['bottom'],
            ) *
              document.getElementsByClassName('player-timedtext')[0].getBoundingClientRect().height;
          window.my_timedtext_element.style['bottom'] =
            sub_bot - window.baseFont * window.current_multiplier - 10 + 'px';
        } catch {
          // no subs on screen
        }
      } catch {
        // no subs on screen
      }
    }
  }
}

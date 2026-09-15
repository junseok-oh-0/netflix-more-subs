// Dual Subtitles for Netflix - content script
//
// Chrome and Edge translators behave differently; both are handled here via window.edge.

import { DEFAULT_PREFERENCES, loadPreferences, onPreferencesChanged } from './preferences.js';

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

chrome.runtime.sendMessage({
  message: 'open_settings_menu',
  value: 'hm',
});

document.addEventListener(
  'DOMContentLoaded',
  function () {
    window.addEventListener('click', function (e) {
      if (e.target.href !== undefined) {
        chrome.tabs.create({ url: e.target.href });
      }
    });

    const slider = document.getElementById('mySlider');
    const slideValue = document.getElementById('mySliderValue');

    const opacitySlider = document.getElementById('opacitySlider');
    const opacitySliderValue = document.getElementById('opacitySliderValue');

    const originalOpacitySlider = document.getElementById('originalOpacitySlider');
    const originalOpacitySliderValue = document.getElementById('originalOpacitySliderValue');

    const colorPicker = document.getElementById('myColorPicker');
    const originalColorPicker = document.getElementById('myOriginalColorPicker');

    const resetButton = document.getElementById('resetButton');
    const onSwitch = document.getElementById('switchValue');
    const button_upDownMode = document.getElementById('button_upDownValue');

    chrome.storage.sync.get('font_multiplier', function (data) {
      slideValue.innerHTML = data.font_multiplier;
      slider.value = data.font_multiplier;
    });

    chrome.storage.sync.get('opacity', function (data) {
      opacitySlider.value = data.opacity;
      opacitySliderValue.innerHTML = data.opacity;
    });

    chrome.storage.sync.get('originaltext_opacity', function (data) {
      originalOpacitySlider.value = data.originaltext_opacity;
      originalOpacitySliderValue.innerHTML = data.originaltext_opacity;
    });

    chrome.storage.sync.get('text_color', function (data) {
      colorPicker.value = data.text_color;
    });

    chrome.storage.sync.get('originaltext_color', function (data) {
      originalColorPicker.value = data.originaltext_color;
    });

    chrome.storage.sync.get('on_off', function (data) {
      onSwitch.checked = data.on_off;
    });

    chrome.storage.sync.get('button_up_down_mode', function (data) {
      button_upDownMode.checked = data.button_up_down_mode;
    });

    slider.addEventListener(
      'change',
      function () {
        slideValue.innerHTML = this.value;
        slider.value = this.value;
        chrome.runtime.sendMessage({
          message: 'update_font_multiplier',
          value: this.value,
        });
      },
      false,
    );

    opacitySlider.addEventListener(
      'change',
      function () {
        opacitySliderValue.innerHTML = this.value;
        opacitySlider.value = this.value;
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
        chrome.runtime.sendMessage({
          message: 'update_originaltext_opacity',
          value: this.value,
        });
      },
      false,
    );

    colorPicker.addEventListener(
      'input',
      function () {
        colorPicker.value = this.value;
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
        chrome.runtime.sendMessage({
          message: 'update_originaltext_color',
          value: this.value,
        });
      },
      false,
    );

    onSwitch.addEventListener(
      'change',
      function () {
        chrome.runtime.sendMessage({
          message: 'update_on_off',
          value: this.checked,
        });
      },
      false,
    );

    button_upDownMode.addEventListener(
      'change',
      function () {
        chrome.runtime.sendMessage({
          message: 'update_button_up_down_mode',
          value: this.checked,
        });
      },
      false,
    );

    resetButton.addEventListener(
      'click',
      function () {
        colorPicker.value = '#FFFFFF';
        colorPicker.dispatchEvent(new Event('input'));

        originalColorPicker.value = '#FFF000';
        originalColorPicker.dispatchEvent(new Event('input'));

        opacitySlider.value = 0.8;
        opacitySlider.dispatchEvent(new Event('change'));
        originalOpacitySlider.value = 1;
        originalOpacitySlider.dispatchEvent(new Event('change'));

        slider.value = 1;
        slider.dispatchEvent(new Event('change'));
      },
      false,
    );
  },
  false,
);

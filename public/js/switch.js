/**
 *  Light Switch @version v0.1.4
 */

(function () {
  let lightSwitch = document.getElementById('lightSwitch');
  if (!lightSwitch) {
    return;
  }
  
  // We'll use document ready to ensure Select2 is initialized

  /**
   * @function darkmode
   * @summary: changes the theme to 'dark mode' and save settings to local stroage.
   */
  function darkMode() {

    $("html").attr("data-bs-theme", "dark");

    // set light switch input to true
    if (!lightSwitch.checked) {
      lightSwitch.checked = true;
    }
    localStorage.setItem('lightSwitch', 'dark');
    
    // Re-initialize Select2 to apply dark styles
    if ($.fn.select2) {
      // Briefly destroy and recreate select2 to refresh styling
      let selectValue = $("#selectQuery").val();
      $("#selectQuery").select2('destroy');
      $("#selectQuery").select2({
        width: '100%',
        placeholder: "Select SQL Query"
      });
      $("#selectQuery").val(selectValue).trigger('change.select2');
    }
  }

  /**
   * @function lightmode
   * @summary: changes the theme to 'light mode' and save settings to local storage.
   */
  function lightMode() {

    $("html").attr("data-bs-theme", "light");

    if (lightSwitch.checked) {
      lightSwitch.checked = false;
    }
    localStorage.setItem('lightSwitch', 'light');
    
    // Re-initialize Select2 to apply light styles
    if ($.fn.select2) {
      // Briefly destroy and recreate select2 to refresh styling
      let selectValue = $("#selectQuery").val();
      $("#selectQuery").select2('destroy');
      $("#selectQuery").select2({
        width: '100%',
        placeholder: "Select SQL Query"
      });
      $("#selectQuery").val(selectValue).trigger('change.select2');
    }
  }

  /**
   * @function onToggleMode
   * @summary: the event handler attached to the switch. calling @darkMode or @lightMode depending on the checked state.
   */
  function onToggleMode() {
    if (lightSwitch.checked) {
      darkMode();
    } else {
      lightMode();
    }
  }

  /**
   * @function getSystemDefaultTheme
   * @summary: get system default theme by media query
   */
  function getSystemDefaultTheme() {
    const darkThemeMq = window.matchMedia('(prefers-color-scheme: dark)');
    if (darkThemeMq.matches) {
      return 'dark';
    }
    return 'light';
  }

  function setup() {
    var settings = localStorage.getItem('lightSwitch');
    if (settings == null) {
      settings = getSystemDefaultTheme();
    }

    if (settings == 'dark') {
      lightSwitch.checked = true;
    }

    lightSwitch.addEventListener('change', onToggleMode);
    
    // Wait for document ready to apply initial theme
    $(document).ready(function() {
      onToggleMode();
      
      // The updateSelect function handles Select2 initialization
      // Ensure theme is properly applied after a short delay
      setTimeout(function() {
        if (lightSwitch.checked) {
          darkMode();
        } else {
          lightMode();
        }
      }, 100);
    });
  }

  setup();
})();

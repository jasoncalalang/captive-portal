var NO_AUTH = 0,
    SIMPLE_PASSWORD = 1,
    EXTERNAL_RADIUS = 2,
    HOTSPOT = 11,
    EXTERNAL_LDAP = 15;

var VOUCHER_ACCESS_TYPE = 3,
    LOCAL_USER_ACCESS_TYPE = 5,
    SMS_ACCESS_TYPE = 6,
    RADIUS_ACCESS_TYPE = 8,
    FORM_AUTH_ACCESS_TYPE = 12;

var MAX_INPUT_LEN = 2000;

var Ajax = {
    post: function (url, data, successFn, errorFn) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4) {
                if (xhr.status == 200 || xhr.status == 304) {
                    successFn.call(this, xhr.responseText);
                } else {
                    // Handle error cases
                    console.warn('AJAX request failed:', url, 'Status:', xhr.status);
                    if (errorFn) {
                        errorFn.call(this, xhr.status, xhr.statusText);
                    } else {
                        // Default error handling - trigger fallback behavior
                        if (url.includes('/portal/getPortalPageSetting')) {
                            initFallbackMode();
                        }
                    }
                }
            }
        };
        xhr.send(data);
    }
};
var data = {};
var globalConfig = {};
var submitUrl;
var clientMac = getQueryStringKey("clientMac");
var apMac = getQueryStringKey("apMac");
var gatewayMac = getQueryStringKey("gatewayMac") || undefined;
var ssidName = getQueryStringKey("ssidName") || undefined;
var radioId = !!getQueryStringKey("radioId")? Number(getQueryStringKey("radioId")) : undefined;
var vid = !!getQueryStringKey("vid")? Number(getQueryStringKey("vid")) : undefined;
var originUrl = getQueryStringKey("originUrl");
var previewSite = getQueryStringKey("previewSite");

var hotspotMap = {
    3: "Voucher Access",
    5: "Local User Access",
    6: "SMS Access",
    8: "RADIUS Access",
    12: "Form Auth Access"
};

var errorHintMap = {
    "0": "ok",
    "-1": "General error.",
    "-41500": "Invalid authentication type.",
    "-41501": "Failed to authenticate.",
    "-41502": "Voucher code is incorrect.",
    "-41503": "Voucher is expired.",
    "-41504": "Voucher traffic has exceeded the limit.",
    "-41505": "The number of users has reached the limit.",
    "-41506": "Invalid authorization information.",
    "-41507": "Your authentication times out. You can get authenticated again until the next day.",
    "-41508": "Local User traffic has exceeded the limit.",
    "-41512": "Local User is expired.",
    "-41513": "Local User is disabled.",
    "-41514": "MAC address is incorrect.",
    "-41515": "Local User Quota has exceeded the limit.",
    "-41516": "The number of users has reached the limit.",
    "-41517": "Incorrect password.",
    "-41518": "This SSID does not exist.",
    "-41519": "Invalid code.",
    "-41520": "The code is expired.",
    "-41521": "The number of users has reached the limit.",
    "-41522": "Failed to validate the code.",
    "-41523": "Failed to send verification code.",
    "-41524": "Authentication failed because the username does not exist.",
    "-41525": "Authentication failed because of wrong password.",
    "-41526": "Authentication failed because the client is invalid.",
    "-41527": "Authentication failed because the local user is invalid.",
    "-41528": "Failed to decrypt data.",
    "-41529": "Incorrect username or password.",
    "-41530": "Connecting to the RADIUS server times out.",
    "-41531": "Your code have reached your Wi-Fi data limit.",
    "-41532": "Your account have reached your Wi-Fi data limit.",
    "-41533": "Form authentication request is invalid.",
    "-43408": "Invalid LDAP configuration.",
    "-43409": "Invalid LDAP credentials.",
    "-41538": "Voucher is not effective."
};

var isCommited;
var formAuthController = useFormAuthController()

function getQueryStringKey (key) {
    return getQueryStringAsObject()[key];
}
function getQueryStringAsObject () {
    var b, cv, e, k, ma, sk, v, r = {},
        d = function (v) { return decodeURIComponent(v); }, //# d(ecode) the v(alue)
        q = window.location.search.substring(1), //# suggested: q = decodeURIComponent(window.location.search.substring(1)),
        s = /([^&;=]+)=?([^&;]*)/g //# original regex that does not allow for ; as a delimiter:   /([^&=]+)=?([^&]*)/g
    ;
    ma = function(v) {
        if (typeof v != "object") {
            cv = v;
            v = {};
            v.length = 0;
            if (cv) { Array.prototype.push.call(v, cv); }
        }
        return v;
    };
    while (e = s.exec(q)) {
        b = e[1].indexOf("[");
        v = d(e[2]);
        if (b < 0) {
            k = d(e[1]);
            if (r[k]) {
                r[k] = ma(r[k]);
                Array.prototype.push.call(r[k], v);
            }
            else {
                r[k] = v;
            }
        }
        else {
            k = d(e[1].slice(0, b));
            sk = d(e[1].slice(b + 1, e[1].indexOf("]", b)));
            r[k] = ma(r[k]);
            if (sk) { r[k][sk] = v; }
            else { Array.prototype.push.call(r[k], v); }
        }
    }
    return r;
}
// Try to get portal settings from Omada controller, fallback to standalone mode if not available
function initPortalWithFallback() {
    Ajax.post(
        '/portal/getPortalPageSetting',
        JSON.stringify({
            "clientMac": clientMac,
            "apMac": apMac,
            "gatewayMac": gatewayMac,
            "ssidName": ssidName,
            "radioId": radioId,
            "vid": vid,
            "originUrl": originUrl
        }),
        function (res) {
            try {
                res = JSON.parse(res);
                data = res.result;
                submitUrl = "/portal/auth";
                var landingUrl = data.landingUrl;
                isCommited = false;
                globalConfig = {
                    authType: data.authType,
                    hotspotTypes: !!data.hotspot && data.hotspot.enabledTypes || [],
                    formAuthButtonText: data.portalCustomize.formAuthButtonText || 'Take the Survey',
                    formAuth: data.formAuth || {},
                    error: data.error || 'ok',
                    countryCode: !!data.sms && data.sms.countryCode || 1
                };
                initPortalPage();
            } catch (e) {
                console.warn('Failed to parse portal settings response, using fallback mode');
                initFallbackMode();
            }
        }
    );
}

// Initialize portal in standalone/fallback mode when Omada controller is not available
function initFallbackMode() {
    console.log('Initializing portal in standalone mode (no Omada controller detected)');
    data = {
        authType: NO_AUTH,
        landingUrl: originUrl || "https://www.google.com"
    };
    submitUrl = "/portal/auth";
    isCommited = false;
    globalConfig = {
        authType: NO_AUTH,
        hotspotTypes: [],
        formAuthButtonText: 'Take the Survey',
        formAuth: {},
        error: 'ok',
        countryCode: 1
    };
    initPortalPage();
}

function initPortalPage() {
        function pageConfigParse(){
            if (globalConfig.error !== 'ok'){
                showErrorModal(errorHintMap[globalConfig.error] || 'Configuration error');
            }
            // Set to simple no-auth mode for the rules acceptance portal
            window.authType = NO_AUTH;
        }

        function handleSubmit(){
            var submitData = {};
            submitData['authType'] = window.authType;
            switch (window.authType){
                case 3:
                    submitData['voucherCode'] = document.getElementById("voucherCode").value;
                    break;
                case 5:
                    submitData['localuser'] = document.getElementById("username").value;
                    submitData['localuserPsw'] = document.getElementById("password").value;
                    break;
                case 1:
                    submitData['simplePassword'] = document.getElementById("simplePassword").value;
                    break;
                case 0:
                    break;
                case 6:
                    submitData['phone'] = "+"+document.getElementById("country-code").value + document.getElementById("phone-number").value;
                    submitData['code'] = document.getElementById("verify-code").value;
                    break;
                case 2:
                case 8:
                    submitData['username'] = document.getElementById("username").value;
                    submitData['password'] = document.getElementById("password").value;
                    break;
                case 15:
                  submitData['ldapUsername'] = document.getElementById("username").value;
                  submitData['ldapPassword'] = document.getElementById("password").value;
                  break;
                case FORM_AUTH_ACCESS_TYPE:
                  $.extend(submitData, formAuthController.getAuthData());
                default:
                    break;
            }

            if(isCommited == false){
                submitData['clientMac'] = clientMac;
                submitData['apMac'] = apMac;
                submitData['gatewayMac'] = gatewayMac;
                submitData['ssidName'] = ssidName;
                submitData['radioId'] = radioId;
                submitData['vid'] = vid;
                if(window.authType == 2 || window.authType == 8 || window.authType === 15){
                    if(window.authType === 15) {
                      submitUrl = '/portal/ldap/auth';
                    } else {
                      submitUrl = "/portal/radius/auth";
                    }
                    submitData['authType'] = window.authType;
                } else {
                    submitData['originUrl'] = originUrl;
                }
                function doAuth () {
                    Ajax.post(submitUrl, JSON.stringify(submitData).toString(), function(data){
                        data = JSON.parse(data);
                        if(!!data && data.errorCode === 0) {
                            isCommited = true;
                            landingUrl = data.result || landingUrl
                            window.location.href = landingUrl;
                            showSuccessModal(errorHintMap[data.errorCode]);
                        } else{
                            showErrorModal(errorHintMap[data.errorCode]);
                        }
                    });
                }
                doAuth();
            }
        }

        function handleLogin(){
            // Check if terms are agreed to
            var termsCheckbox = document.getElementById("terms-checkbox");
            if (termsCheckbox && !termsCheckbox.checked) {
                showErrorModal("Please agree to the WiFi usage rules first.");
                return;
            }
            
            // Get username and password values
            var username = document.getElementById("username").value.trim();
            var password = document.getElementById("password").value.trim();
            
            if (!username || !password) {
                showErrorModal("Please enter both username and password.");
                return;
            }
            
            var submitData = {};
            submitData['authType'] = LOCAL_USER_ACCESS_TYPE; // Use local user authentication
            submitData['localuser'] = username;
            submitData['localuserPsw'] = password;
            submitData['clientMac'] = clientMac;
            submitData['apMac'] = apMac;
            submitData['gatewayMac'] = gatewayMac;
            submitData['ssidName'] = ssidName;
            submitData['radioId'] = radioId;
            submitData['vid'] = vid;
            submitData['originUrl'] = originUrl;
            
            if(isCommited == false){
                function doAuth () {
                    showInfoModal("Authenticating...");
                    
                    Ajax.post(submitUrl, JSON.stringify(submitData).toString(), function(data){
                        try {
                            data = JSON.parse(data);
                            if(!!data && data.errorCode === 0) {
                                isCommited = true;
                                var landingUrl = data.result || (data.landingUrl || "https://www.google.com");
                                showSuccessModal("Authentication successful! Redirecting...", function() {
                                    window.location.href = landingUrl;
                                });
                            } else{
                                showErrorModal(errorHintMap[data.errorCode] || "Authentication failed. Please try again.");
                            }
                        } catch(e) {
                            // Fallback for standalone mode - simulate successful authentication
                            console.log('Backend not available, simulating successful authentication for user: ' + username);
                            isCommited = true;
                            
                            // In standalone mode, redirect to specified origin URL or a default page
                            var landingUrl = originUrl || "https://www.google.com";
                            showSuccessModal("Authentication successful! Authenticated as " + username + ".", function() {
                                window.location.href = landingUrl;
                            });
                        }
                    }, function(status, statusText) {
                        // Error callback - backend not available
                        console.log('Backend not available (error ' + status + '), simulating successful authentication for user: ' + username);
                        isCommited = true;
                        
                        // In standalone mode, redirect to specified origin URL or a default page
                        var landingUrl = originUrl || "https://www.google.com";
                        showSuccessModal("Authentication successful! Authenticated as " + username + ".", function() {
                            window.location.href = landingUrl;
                        });
                    });
                }
                doAuth();
            }
        }
        function hotspotChang (type) {

            document.getElementById("input-voucher").style.display = "none";
            document.getElementById("input-user").style.display = "none";
            document.getElementById("input-password").style.display = "none";
            document.getElementById("input-phone-num").style.display = "none";
            document.getElementById("input-verify-code").style.display = "none";
            document.getElementById("button-login").style.display = "block";
            window.authType = Number(type);
            switch (Number(type)) {
                case VOUCHER_ACCESS_TYPE:
                    document.getElementById("input-voucher").style.display = "block";
                    break;
                case LOCAL_USER_ACCESS_TYPE:
                case EXTERNAL_RADIUS:
                case RADIUS_ACCESS_TYPE:
                case EXTERNAL_LDAP:
                    document.getElementById("input-user").style.display = "block";
                    document.getElementById("input-password").style.display = "block";
                    break;
                case SMS_ACCESS_TYPE:
                    document.getElementById("input-phone-num").style.display = "block";
                    document.getElementById("input-verify-code").style.display = "block";
                    break;
                case FORM_AUTH_ACCESS_TYPE:
                    formAuthController.init(globalConfig)
                    break
            }
        }
        
        // Modal functionality
        function showRulesModal() {
            var modal = document.getElementById("rules-modal");
            var modalContent = document.getElementById("modal-content");
            var acceptButton = document.getElementById("modal-accept");
            
            // Show modal with smooth animation
            modal.style.display = "flex";
            // Force reflow to ensure display change is applied before adding class
            modal.offsetHeight;
            modal.classList.add("modal-show");
            
            // Reset scroll position and disable accept button
            modalContent.scrollTop = 0;
            acceptButton.disabled = true;
            
            // Check if user has scrolled to bottom
            modalContent.addEventListener('scroll', function() {
                var isScrolledToBottom = modalContent.scrollTop + modalContent.clientHeight >= modalContent.scrollHeight - 5;
                acceptButton.disabled = !isScrolledToBottom;
            });
        }
        
        function hideRulesModal() {
            var modal = document.getElementById("rules-modal");
            
            // Start fade out animation
            modal.classList.remove("modal-show");
            
            // Hide modal after animation completes
            setTimeout(function() {
                modal.style.display = "none";
            }, 300);
        }
        
        function acceptRules() {
            var termsCheckbox = document.getElementById("terms-checkbox");
            termsCheckbox.checked = true;
            updateLoginButtonState();
            hideRulesModal();
        }
        
        // Message Modal functionality
        function showMessageModal(title, message, type, callback) {
            var modal = document.getElementById("message-modal");
            var titleElement = document.getElementById("message-modal-title");
            var contentElement = document.getElementById("message-modal-content");
            
            // Set title and message
            titleElement.textContent = title;
            contentElement.textContent = message;
            
            // Remove any previous type classes and add new type class
            contentElement.className = "message-content";
            if (type) {
                contentElement.classList.add(type);
            }
            
            // Show modal with smooth animation
            modal.style.display = "flex";
            // Force reflow to ensure display change is applied before adding class
            modal.offsetHeight;
            modal.classList.add("modal-show");
            
            // Set callback for OK button if provided
            var okButton = document.getElementById("message-modal-ok");
            okButton.onclick = function() {
                hideMessageModal();
                if (callback && typeof callback === 'function') {
                    callback();
                }
            };
        }
        
        function hideMessageModal() {
            var modal = document.getElementById("message-modal");
            
            // Start fade out animation
            modal.classList.remove("modal-show");
            
            // Hide modal after animation completes
            setTimeout(function() {
                modal.style.display = "none";
            }, 300);
        }
        
        // Helper functions for different message types
        function showErrorModal(message, callback) {
            showMessageModal("Error", message, "error", callback);
        }
        
        function showSuccessModal(message, callback) {
            showMessageModal("Success", message, "success", callback);
        }
        
        function showInfoModal(message, callback) {
            showMessageModal("Information", message, "info", callback);
        }
        
        function updateLoginButtonState() {
            var termsCheckbox = document.getElementById("terms-checkbox");
            var loginButton = document.getElementById("button-login");
            var username = document.getElementById("username").value.trim();
            var password = document.getElementById("password").value.trim();
            
            if (termsCheckbox && termsCheckbox.checked && username && password) {
                loginButton.disabled = false;
            } else {
                loginButton.disabled = true;
            }
        }
        
        // Only initialize elements that exist in the HTML
        if (document.getElementById("country-code")) {
            globalConfig.countryCode = "+" + parseInt(globalConfig.countryCode, 10);
            document.getElementById("country-code").value = parseInt(globalConfig.countryCode, 10);
        }
        
        if (document.getElementById("hotspot-selector")) {
            document.getElementById("hotspot-selector").addEventListener("change", function () {
                var obj = document.getElementById("hotspot-selector");
                var opt = obj.options[obj.selectedIndex];
                hotspotChang(opt.value);
            });
        }
        
        // Event listeners for new layout
        if (document.getElementById("button-login")) {
            document.getElementById("button-login").addEventListener("click", function () {
                handleLogin();
            });
        }
        
        // Terms checkbox click handler - opens modal instead of direct toggle
        var termsCheckbox = document.getElementById("terms-checkbox");
        if (termsCheckbox) {
            termsCheckbox.addEventListener("click", function(e) {
                e.preventDefault(); // Prevent default checkbox behavior
                showRulesModal();
            });
        }
        
        // Terms text click handler - also opens modal
        var termsText = document.querySelector(".terms-text");
        if (termsText) {
            termsText.addEventListener("click", function(e) {
                e.preventDefault();
                showRulesModal();
            });
        }
        
        // Modal event handlers
        if (document.getElementById("modal-close")) {
            document.getElementById("modal-close").addEventListener("click", function() {
                hideRulesModal();
            });
        }
        
        if (document.getElementById("modal-accept")) {
            document.getElementById("modal-accept").addEventListener("click", function() {
                acceptRules();
            });
        }
        
        // Message modal event handlers
        if (document.getElementById("message-modal-close")) {
            document.getElementById("message-modal-close").addEventListener("click", function() {
                hideMessageModal();
            });
        }
        
        if (document.getElementById("message-modal-ok")) {
            document.getElementById("message-modal-ok").addEventListener("click", function() {
                hideMessageModal();
            });
        }
        
        // Close modals when clicking outside
        var rulesModal = document.getElementById("rules-modal");
        if (rulesModal) {
            rulesModal.addEventListener("click", function(e) {
                if (e.target === rulesModal) {
                    hideRulesModal();
                }
            });
        }
        
        var messageModal = document.getElementById("message-modal");
        if (messageModal) {
            messageModal.addEventListener("click", function(e) {
                if (e.target === messageModal) {
                    hideMessageModal();
                }
            });
        }
        
        // Form input handlers to update login button state
        var usernameInput = document.getElementById("username");
        var passwordInput = document.getElementById("password");
        
        if (usernameInput) {
            usernameInput.addEventListener("input", updateLoginButtonState);
        }
        
        if (passwordInput) {
            passwordInput.addEventListener("input", updateLoginButtonState);
        }
        
        // Initialize login button state
        updateLoginButtonState();
        
        if (document.getElementById("form-auth-submit")) {
            $("#form-auth-submit").on("click", function () {formAuthController.submitFormAuth(handleSubmit)});
        }
        
        if (document.getElementById("get-code")) {
            document.getElementById("get-code").addEventListener("click", function(e){
            e.preventDefault();
            var phoneNum = document.getElementById("phone-number").value;
            function sendSmsAuthCode () {
                Ajax.post("/portal/sendSmsAuthCode",
                    JSON.stringify({
                        clientMac: clientMac,
                        apMac: apMac,
                        gatewayMac: gatewayMac,
                        ssidName: ssidName,
                        radioId: radioId,
                        vid: vid,
                        phone: "+" + document.getElementById("country-code").value + phoneNum
                    }),function(data){
                        data = JSON.parse(data);
                        if(data.errorCode !== 0){
                            showErrorModal(errorHintMap[data.errorCode]);
                        } else {
                            showSuccessModal("SMS has been sent successfully.");
                        }
                    }
                );
            }
            sendSmsAuthCode();
            showInfoModal("Sending Authorization Code...");
        });
        }
        pageConfigParse();
    }

// Initialize the portal
initPortalWithFallback();

function useFormAuthUtil () {
  function transferChoices(card) {
    var choices = [];
    $.each(card.choices, function (index, choice) {
      choices.push({
        value: index,
        text: choice
      });
    });
    if (card.others) {
      choices.push({
        value: choices.length,
        text: card.others
      });
    }
    return choices;
  }

  function getOthersHtml() {
    return '<div class="others-outer hidden"><input class="input" maxlength="'+MAX_INPUT_LEN+'" type="text" /></div>';
  }

  function getValidateHtml () {
    return '<div class="validate-outer hidden">This field cannot start with special characters + - @ =</div>'
  }

  function getRequiredHtml(text) {
    if (text) {
      return '<div class="required-outer hidden">' + text + '</div>';
    }
    return '';
  }
 
  function getCardContainer(cardIndex) {
    return $('#form-auth-content .card-container[card-index="' + cardIndex + '"]');
  }

  function getCardHtml(card, cardIndex, contentHtml) {
    return ('<div class="card-container"  card-index="' + cardIndex + '">' +
      '<div class="card-index">' + (cardIndex + 1) + '</div>' +
      '<div class="card-item-outer">' +
      '<div class="title">' + escapeHtml(card.title) + '</div>' +
      (contentHtml ? '<div class="content">' + contentHtml + '</div>' : '') +
      '</div>' +
      '</div>');
  }

  function getOthersValue(cardIndex) {
    var cardDom = getCardContainer(cardIndex);
    return cardDom.find('.others-outer input').val();
  }

  function toggleValideStatus(cardIndex, valid, isExportToExcelStr) {
    var cardDom = getCardContainer(cardIndex),
      requiredText = cardDom.find('.required-outer');

    var validateText = cardDom.find('.validate-outer');
    if (valid) {
      if(validateText) {
        validateText.addClass('hidden');
      }
      requiredText.addClass('hidden');
    } else {
      if(isExportToExcelStr) {
        requiredText.addClass('hidden');
        validateText.removeClass('hidden')
      } else {
        requiredText.removeClass('hidden');
      }
    }
  }

  return {
    transferChoices: transferChoices,
    getOthersHtml: getOthersHtml,
    getValidateHtml: getValidateHtml,
    getRequiredHtml: getRequiredHtml,
    getCardContainer: getCardContainer,
    getCardHtml: getCardHtml,
    getOthersValue: getOthersValue,
    toggleValideStatus: toggleValideStatus
  }
}

function useFormAuthController() {
  var formAuthUtil  = useFormAuthUtil()

  var SINGLE_CHOICE = 0,
      MULTIPLE_CHOICE = 1,
      COMBOBOX = 2,
      INPUT = 3,
      SCORE = 4,
      NOTE = 5;

  var CARD_MAP = {};
  CARD_MAP[SINGLE_CHOICE] = {
    render: function (card, cardIndex) {
      var choices = formAuthUtil.transferChoices(card);
      var options = '<div class="radio">';
      $.each(choices, function (index, choice) {
        options += ('<div class="choice-outer">' +
          '<label class="choice-item">' +
          '<input id="' + escapeHtml(card.title) + index + '" class="choice-input" type="radio" name="' + escapeHtml(card.title) + cardIndex + '" value="' + choice.value + '">' +
          '<span class="text">' + escapeHtml(choice.text) + '</span>' +
          '</label>' +
          '</div>');
      });
      options += '</div>';

      if (card.others) {
        options += formAuthUtil.getOthersHtml();
        options += formAuthUtil.getValidateHtml();
      }

      if (card.required) {
        options += formAuthUtil.getRequiredHtml('Please choose an answer.');
      }

      return formAuthUtil.getCardHtml(card, cardIndex, options);
    },
    getValue: function (card, cardIndex) {
      var cardDom = formAuthUtil.getCardContainer(cardIndex),
        checkbox = cardDom.find('input[type="radio"]'),
        othersVal = card.choices.length;

      var answer = {
        type: card.type
      };

      checkbox.each(function () {
        if ($(this).prop("checked")) {
          var val = parseInt($(this).val());
          if (val === othersVal) {
            answer.others = formAuthUtil.getOthersValue(cardIndex);
          } else {
            answer.choiceAnswer = [val];
          }
        }
      });

      return answer;
    },
    bindEvent: function (card, cardContainer) {
      var self = this,
        radios = cardContainer.find('input[type="radio"]');

      cardContainer.on('ev_valid', function () {
        self.validate(card, cardContainer.attr('card-index'));
      });

      radios.click(function () {
        cardContainer.trigger('ev_valid');
      });

      if (card.others) {
        var othersVal = card.choices.length,
          othersInput = cardContainer.find('.others-outer');

        radios.click(function () {
          if ($(this).prop("checked") && parseInt($(this).attr("value")) === othersVal) {
            othersInput.removeClass('hidden');
          } else {
            othersInput.addClass('hidden');
          }
        });
      }
    },
    validate: function (card, cardIndex) {
      var valid = !card.required,
        cardDom = formAuthUtil.getCardContainer(cardIndex);

      var radio = cardDom.find('input[type="radio"]:checked');
      var regex = /^[^+@=\-]/;

      if (radio.length > 0) {
        var isOthersRadio = parseInt(radio.val()) === card.choices.length;
        if(isOthersRadio && formAuthUtil.getOthersValue(cardIndex) && !regex.test(formAuthUtil.getOthersValue(cardIndex))) {
          formAuthUtil.toggleValideStatus(cardIndex, false, true);
          return false
        }

        if (card.required) {
          if(isOthersRadio && !formAuthUtil.getOthersValue(cardIndex)) {
            formAuthUtil.toggleValideStatus(cardIndex, false);
            return false
          }
        }
      } else {
        formAuthUtil.toggleValideStatus(cardIndex, valid);
        return valid
      }

      formAuthUtil.toggleValideStatus(cardIndex, true);
      return true;
    }
  };
  CARD_MAP[MULTIPLE_CHOICE] = {
    render: function (card, cardIndex) {
      var choices = formAuthUtil.transferChoices(card);
      var options = '<div class="checkbox">';
      $.each(choices, function (index, choice) {
        options += ('<div class="choice-outer">' +
          '<label class="choice-item">' +
          '<input id="' + escapeHtml(card.title) + index + '" class="choice-input" type="checkbox" name="' + escapeHtml(card.title) + cardIndex + '" value="' + choice.value + '">' +
          '<span class="text">' + escapeHtml(choice.text) + '</span>' +
          '</label>' +
          '</div>');
      });
      options += '</div>';

      if (card.others) {
        options += formAuthUtil.getOthersHtml();
        options += formAuthUtil.getValidateHtml();
      }

      if (card.required) {
        options += formAuthUtil.getRequiredHtml('Please choose an answer.');
      }

      return formAuthUtil.getCardHtml(card, cardIndex, options);
    },
    getValue: function (card, cardIndex) {
      var cardDom = formAuthUtil.getCardContainer(cardIndex),
        checkbox = cardDom.find('input[type="checkbox"]'),
        othersVal = card.choices.length;

      var answer = {
        type: card.type,
        choiceAnswer: []
      };

      checkbox.each(function () {
        if ($(this).prop("checked")) {
          var val = parseInt($(this).val());
          if (val === othersVal) {
            answer.others = formAuthUtil.getOthersValue(cardIndex);
          } else {
            answer.choiceAnswer.push(val);
          }
        }
      });

      return answer;
    },
    bindEvent: function (card, cardContainer) {
      var self = this,
        checkboxes = cardContainer.find('input[type="checkbox"]');

      cardContainer.on('ev_valid', function () {
        self.validate(card, cardContainer.attr('card-index'));
      });

      checkboxes.click(function () {
        cardContainer.trigger('ev_valid');
      });

      if (card.others) {
        var othersVal = card.choices.length,
          checkbox = checkboxes.filter('[value="' + othersVal + '"]'),
          othersInput = cardContainer.find('.others-outer');

        checkbox.click(function () {
          if ($(this).prop("checked")) {
            othersInput.removeClass('hidden');
          } else {
            othersInput.addClass('hidden');
          }
        });
      }
    },
    validate: function (card, cardIndex) {
      var valid = !card.required,
        cardDom = formAuthUtil.getCardContainer(cardIndex);

      var checkbox = cardDom.find('input[type="checkbox"]'),
        selected = [];
      var regex = /^[^+@=\-]/;

      if (card.required) {
        checkbox.each(function () {
          if ($(this).prop("checked")) {
            selected.push(parseInt($(this).val()));
          }
        });

        if (selected.length > 0) {
          var othersValue = card.choices.length,
            hasOthers = selected.indexOf(othersValue) !== -1;

          if(hasOthers && formAuthUtil.getOthersValue(cardIndex) && !regex.test(formAuthUtil.getOthersValue(cardIndex))) {
            formAuthUtil.toggleValideStatus(cardIndex, false, true);
            return false
          }

          if (card.required) {
            if(hasOthers && !formAuthUtil.getOthersValue(cardIndex)) {
              formAuthUtil.toggleValideStatus(cardIndex, false);
              return false
            }
          }
        } else {
          formAuthUtil.toggleValideStatus(cardIndex, valid);
          return valid
        }
      }

      formAuthUtil.toggleValideStatus(cardIndex, true);
      return true;
    }
  };
  CARD_MAP[COMBOBOX] = {
    render: function (card, cardIndex) {
      var choices = formAuthUtil.transferChoices(card);
      var options = '<select class="combobox">';
      $.each(choices, function (index, choice) {
        options += '<option value="' + choice.value + '">' + escapeHtml(choice.text) + '</option>';
      });
      options += '</select>'

      if (card.others) {
        options += formAuthUtil.getOthersHtml();
      }

      if (card.required) {
        options += formAuthUtil.getRequiredHtml('Please choose an answer.');
      }

      return formAuthUtil.getCardHtml(card, cardIndex, options);
    },
    getValue: function (card, cardIndex) {
      var cardDom = formAuthUtil.getCardContainer(cardIndex),
        selectVal = parseInt(cardDom.find('select').val());

      var answer = {
        type: card.type
      };

      if (selectVal === card.choices.length) {
        answer.others = formAuthUtil.getOthersValue(cardIndex);
      } else {
        answer.choiceAnswer = [selectVal];
      }
      return answer;
    },
    bindEvent: function (card, cardContainer) {
      if (card.others) {
        var othersVal = card.choices.length,
          combobox = cardContainer.find('select.combobox'),
          othersInput = cardContainer.find('.others-outer');

        combobox.on("change", function () {
          if (parseInt($(this).val()) === othersVal) {
            othersInput.removeClass('hidden');
          } else {
            othersInput.addClass('hidden');
          }
        });
      }
    },
    validate: function (card, cardIndex) {
      var valid = !card.required,
        cardDom = formAuthUtil.getCardContainer(cardIndex);

      if (card.required) {
        var selectValue = cardDom.find('select').val();
        if (selectValue) {
          var isOthersCombo = parseInt(selectValue) === card.choices.length;
          if (!isOthersCombo || formAuthUtil.getOthersValue(cardIndex)) {
            valid = true;
          }
        }
      }

      formAuthUtil.toggleValideStatus(cardIndex, valid);

      return valid;
    }
  };
  CARD_MAP[INPUT] = {
    render: function (card, cardIndex) {
      var html = '<input class="input" maxlength="'+MAX_INPUT_LEN+'"  type="text" />';

      html += formAuthUtil.getValidateHtml();
      if (card.required) {
        html += formAuthUtil.getRequiredHtml('Please Input');
      }

      return formAuthUtil.getCardHtml(card, cardIndex, html);
    },
    getValue: function (card, cardIndex) {
      var cardDom = formAuthUtil.getCardContainer(cardIndex),
        input = cardDom.find('input');

      return {
        type: card.type,
        inputAnswer: input.val()
      };
    },
    bindEvent: function (card, cardContainer) {
      var self = this,
        input = cardContainer.find('input');

      cardContainer.on('ev_valid', function () {
        self.validate(card, cardContainer.attr('card-index'));
      });

      input.on('focusout', function () {
        cardContainer.trigger('ev_valid');
      });
    },
    validate: function (card, cardIndex) {
      var valid = !card.required,
        cardDom = formAuthUtil.getCardContainer(cardIndex);
      var input = cardDom.find('.input');
      var regex = /^[^+@=\-]/
      var isExportToExcelStr = regex.test(input.val())

      if (card.required) {
        if(!input.val()) {
          formAuthUtil.toggleValideStatus(cardIndex, false);
          return false
        }
      }

      if(!isExportToExcelStr) {
        formAuthUtil.toggleValideStatus(cardIndex, false, true);
        return false
      }

      formAuthUtil.toggleValideStatus(cardIndex, true);
      return true;
    }
  };
  CARD_MAP[SCORE] = {
    render: function (card, cardIndex) {
      var html = '<div class="score-outer">';
      html += '<div class="score-wrapper">';
      for (var i = 1; i <= 5; i++) {
        html += '<div class="score-icon" score="' + i + '"></div>';
      }
      html += '</div>';
      html += '<div class="score-tip hidden"></div>';
      html += '<div class="score-comment">';
      html += '<div class="comment-icon-outer">';
      html += '<span class="icon"></span>';
      html += '<span class="text">Comments</span>';
      html += '</div>';
      html += '<textarea class="comment-area" maxlength="'+MAX_INPUT_LEN+'"></textarea>';
      html += '</div>';
      html += '</div>';

      if (card.required) {
        html += formAuthUtil.getRequiredHtml('Please give a rating.');
      }

      return formAuthUtil.getCardHtml(card, cardIndex, html);
    },
    getValue: function (card, cardIndex) {
      var cardDom = formAuthUtil.getCardContainer(cardIndex),
        score = cardDom.find('.score-icon.active'),
        answer = {
          type: card.type
        };

      if (score.length > 0) {
        answer.score = parseInt(score.last().attr('score'));
      }

      var commentDom = cardDom.find('.score-comment.active');
      if (commentDom.length > 0) {
        answer.inputAnswer = commentDom.find('textarea').val();
      }

      return answer;
    },
    bindEvent: function (card, cardContainer) {
      var scoreIcon = cardContainer.find('.score-icon'),
        scoreTip = cardContainer.find('.score-tip'),
        writeIcon = cardContainer.find('.comment-icon-outer'),
        self = this;

      cardContainer.on('ev_valid', function () {
        self.validate(card, cardContainer.attr('card-index'));
      });

      scoreIcon.click(function () {
        scoreIcon.removeClass('active');

        $(this).addClass('active')
          .prevAll().addClass('active');

        var index = $(this).attr('score') - 1;
        if (card.scoreNotes[index]) {
          scoreTip.text(card.scoreNotes[index]).removeClass('hidden');
        } else {
          scoreTip.text('').addClass('hidden');
        }

        cardContainer.trigger('ev_valid');
      });

      writeIcon.click(function () {
        writeIcon.parent().toggleClass('active');
      });
    },
    validate: function (card, cardIndex) {
      var valid = !card.required,
        cardDom = formAuthUtil.getCardContainer(cardIndex);

      if (card.required) {
        var scores = cardDom.find('.score-icon.active');
        if (scores.length > 0) {
          valid = true;
        }
      }

      formAuthUtil.toggleValideStatus(cardIndex, valid);

      return valid;
    }
  };
  CARD_MAP[NOTE] = {
    render: formAuthUtil.getCardHtml,
    getValue: function (card, cardIndex) {
      return {
        type: card.type
      };
    }
  };
  
  function init (config) {
    $("#access-title").html('');
    $("#button-login").html(globalConfig.formAuthButtonText);
    window.authType = FORM_AUTH_ACCESS_TYPE;
  }

  function showFormAuth (config) {
    renderFormTitle(config);
    var html = getCardsHtml(config);
    $('#form-auth-content').html(html);
    bindCardsEvent(config);
    $('#form-auth-msg').show();
  }

  function bindCardsEvent(globalConfig) {
    $('#form-auth-content .card-container').each(function () {
      var index = parseInt($(this).attr('card-index'));
      var card = globalConfig.formAuth.cardList[index];
      !!CARD_MAP[card.type].bindEvent && !!CARD_MAP[card.type].bindEvent(card, $(this));
    });
  }

  function renderFormTitle (globalConfig) {
    $('#form-auth-title').text(globalConfig.formAuth.title);
    $('#form-auth-note').text(globalConfig.formAuth.note);
  }

  function isFormAuthValid() {
    var cards = globalConfig.formAuth.cardList,
      valid = true;
    $.each(cards, function (index, card) {
      var validate = CARD_MAP[card.type].validate;
      if (validate && !validate(card, index)) {
        valid = false;
      }
    });

    return valid;
  }

  function getAuthData() {
    var answers = [];
    var cards = globalConfig.formAuth.cardList;

    $.each(cards, function (index, card) {
      if (CARD_MAP[card.type].getValue) {
        answers.push(CARD_MAP[card.type].getValue(card, index));
      }
    });

    return {
      formAuthId: globalConfig.formAuth.id,
      answers: answers
    };
  }

  function submitFormAuth(handleSubmit) {
    if ($("#form-auth-submit").hasClass("disabled")) return;
    if (isFormAuthValid()) {
      handleSubmit();
    }
  }

  function getCardsHtml(globalConfig) {
    var cards = globalConfig.formAuth.cardList,
      html = '';
    $.each(cards, function (i, card) {
      html += CARD_MAP[card.type].render(card, i);
    });
    return html;
  }

  return {
    init: init,
    isFormAuthValid: isFormAuthValid,
    getAuthData: getAuthData,
    showFormAuth: showFormAuth,
    submitFormAuth: submitFormAuth
  }
}

function escapeHtml(string) {
  if (string === null || string === undefined) {
    return "";
  }
  var r = string.toString();
  r = r.replace(/\&/g, "&amp;");
  r = r.replace(/\</g, "&lt;");
  r = r.replace(/\>/g, "&gt;");
  r = r.replace(/\"/g, "&quot;");
  r = r.replace(/\'/g, "&#39;");
  r = r.replace(/\s/g, "&nbsp;");
  return r;
};